"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { differenceInCalendarDays, format, parseISO, startOfToday } from "date-fns";
import { HardDrive, LayoutGrid, MoreHorizontal, Plus, Rows3, UsersRound } from "lucide-react";
import { Toaster } from "sonner";
import { ArchiveDialog } from "@/components/board/archive-dialog";
import { BoardCanvas } from "@/components/board/board-canvas";
import { BoardDialog } from "@/components/board/board-dialog";
import { TaskModal } from "@/components/board/task-modal";
import { TaskTable } from "@/components/board/task-table";
import { TeamDialog } from "@/components/board/team-dialog";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar, type TaskNotification } from "@/components/layout/topbar";
import { SelectMenu } from "@/components/ui/select-menu";
import { useBoardStore } from "@/store/use-board-store";
import { pluralize } from "@/lib/utils";
import { getAccess } from "@/lib/permissions";
import type { TaskSort } from "@/lib/task-filter";
import type { Filters, SessionUser, WorkspaceSnapshot } from "@/types/board";

const defaultFilters: Filters = { priorities: [], statuses: [], label: "", due: "all" };

export function DashboardApp({ initialSnapshot }: { initialSnapshot: WorkspaceSnapshot }) {
  const currentUser = initialSnapshot.currentUser;
  const access = getAccess(currentUser);
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [dark, setDark] = useState(() => typeof window === "undefined" ? true : localStorage.getItem("flowboard-theme") !== "light");
  const [compact, setCompact] = useState(false);
  const [sort, setSort] = useState<TaskSort>("manual");
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [boardDialogOpen, setBoardDialogOpen] = useState(false);
  const [managedBoardId, setManagedBoardId] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => new Set(initialSnapshot.readNotificationIds));
  const activeBoardId = useBoardStore((state) => state.activeBoardId);
  const boards = useBoardStore((state) => state.boards);
  const board = useBoardStore((state) => state.boards[activeBoardId]);
  const lists = useBoardStore((state) => state.lists);
  const tasks = useBoardStore((state) => state.tasks);
  const employees = useBoardStore((state) => state.employees);
  const hydrated = useBoardStore((state) => state.hydrated);
  const saving = useBoardStore((state) => state.saving);
  const saveError = useBoardStore((state) => state.saveError);
  const hydrateWorkspace = useBoardStore((state) => state.hydrateWorkspace);
  const setActiveBoardLocal = useBoardStore((state) => state.setActiveBoardLocal);

  useEffect(() => {
    hydrateWorkspace(initialSnapshot);
  }, [hydrateWorkspace, initialSnapshot]);

  useEffect(() => {
    const verify = async () => {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (response.status === 401) window.location.assign("/login");
      if (response.ok) {
        const result = await response.json() as { user?: SessionUser };
        if (result.user && (result.user.role !== currentUser.role || result.user.canEditDeadlines !== currentUser.canEditDeadlines || result.user.boardIds.join("|") !== currentUser.boardIds.join("|"))) window.location.reload();
      }
    };
    const interval = window.setInterval(() => void verify(), 10_000);
    const onVisibility = () => document.visibilityState === "visible" && void verify();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisibility); };
  }, [currentUser.boardIds, currentUser.canEditDeadlines, currentUser.role]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".search-box input")?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("flowboard-theme", dark ? "dark" : "light");
  }, [dark]);

  const boardTasks = useMemo(() => board?.listIds.flatMap((id) => lists[id]?.taskIds ?? []).map((id) => tasks[id]).filter((task) => task && !task.archived) ?? [], [board, lists, tasks]);
  const availableLabels = useMemo(() => {
    return [...new Set(boardTasks.flatMap((task) => task.labels))].sort((a, b) => a.localeCompare(b, "ru"));
  }, [boardTasks]);
  const notifications = useMemo<TaskNotification[]>(() => {
    const taskBoard = new Map<string, string>();
    Object.values(boards).forEach((currentBoard) => currentBoard.listIds.forEach((listId) => lists[listId]?.taskIds.forEach((taskId) => taskBoard.set(taskId, currentBoard.id))));
    const today = startOfToday();
    const result: TaskNotification[] = [];
    Object.values(tasks).filter((task) => !task.archived).forEach((task) => {
      const boardId = taskBoard.get(task.id);
      if (!boardId) return;
      if (!task.closed && task.dueDate) {
        const days = differenceInCalendarDays(parseISO(task.dueDate), today);
        if (days < 0) result.push({ id: `task-overdue-${task.id}`, kind: "overdue", title: `Просрочена: ${task.title}`, detail: `Дедлайн ${format(parseISO(task.dueDate), "dd.MM.yyyy")}`, taskId: task.id, boardId });
        else if (days <= 3) result.push({ id: `task-soon-${task.id}`, kind: "soon", title: `Скоро дедлайн: ${task.title}`, detail: days === 0 ? "Срок истекает сегодня" : `Осталось ${days} дн.`, taskId: task.id, boardId });
      }
      task.checklist.filter((item) => !item.completed && item.dueDate).forEach((item) => {
        const days = differenceInCalendarDays(parseISO(item.dueDate!), today);
        if (days < 0) result.push({ id: `check-overdue-${task.id}-${item.id}`, kind: "overdue", title: `Просрочен пункт: ${item.title}`, detail: `Задача «${task.title}»`, taskId: task.id, boardId });
        else if (days <= 3) result.push({ id: `check-soon-${task.id}-${item.id}`, kind: "soon", title: `Срок пункта: ${item.title}`, detail: days === 0 ? `Сегодня · ${task.title}` : `Через ${days} дн. · ${task.title}`, taskId: task.id, boardId });
      });
      const mention = `@${currentUser.name}`.toLocaleLowerCase("ru");
      task.comments.filter((comment) => comment.author !== currentUser.name && ((comment.mentionIds ?? []).includes(currentUser.id) || comment.text.toLocaleLowerCase("ru").includes(mention))).forEach((comment) => result.push({ id: `mention-${task.id}-${comment.id}`, kind: "mention", title: `${comment.author} упомянул(а) вас`, detail: `В задаче «${task.title}»`, taskId: task.id, boardId }));
    });
    const rank = { overdue: 0, mention: 1, soon: 2 } as const;
    return result.sort((a, b) => rank[a.kind] - rank[b.kind] || a.title.localeCompare(b.title, "ru")).slice(0, 30);
  }, [boards, currentUser.id, currentUser.name, lists, tasks]);

  const markNotificationRead = (notification: TaskNotification) => {
    if (readNotificationIds.has(notification.id)) return;
    setReadNotificationIds((current) => new Set(current).add(notification.id));
    void fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: notification.id }),
    }).then((response) => {
      if (response.status === 401) window.location.assign("/login");
      if (!response.ok) setReadNotificationIds((current) => { const next = new Set(current); next.delete(notification.id); return next; });
    }).catch(() => setReadNotificationIds((current) => { const next = new Set(current); next.delete(notification.id); return next; }));
  };

  if (!mounted || !hydrated) return <div className="app-loading"><div className="loading-logo">F</div><div className="loading-line" /><span>Загружаем защищённое рабочее пространство…</span></div>;

  if (!board) return (
    <main className="empty-workspace"><div className="brand-mark large">F</div><h1>{access.canEditWorkspace ? "Создайте первую доску" : "Нет доступных досок"}</h1><p>{access.canEditWorkspace ? "Организуйте проект в списках и двигайте задачи к результату." : "Попросите администратора добавить доску или изменить ваш уровень доступа."}</p>{access.canEditWorkspace && <><button className="button primary" onClick={() => { setManagedBoardId(null); setBoardDialogOpen(true); }}><Plus size={16} />Создать доску</button><BoardDialog key={`new-${boardDialogOpen}`} open={boardDialogOpen} boardId={null} onClose={() => setBoardDialogOpen(false)} /></>}</main>
  );

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-is-collapsed" : ""} ${compact ? "compact-mode" : ""} ${mobileOpen ? "mobile-sidebar-open" : ""}`}>
      <Sidebar currentUser={currentUser} canEdit={access.canEditWorkspace} canManageBoards={access.canManageBoards} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} onCreateBoard={() => { setManagedBoardId(null); setBoardDialogOpen(true); }} onManageBoard={(id) => { setManagedBoardId(id); setBoardDialogOpen(true); }} onOpenArchive={() => setArchiveOpen(true)} />
      {mobileOpen && <button className="mobile-overlay" onClick={() => setMobileOpen(false)} aria-label="Закрыть меню" />}
      <div className="workspace">
        <Topbar currentUser={currentUser} search={search} onSearch={setSearch} filters={filters} onFilters={setFilters} filterOpen={filterOpen} onFilterOpen={setFilterOpen} dark={dark} onThemeToggle={() => setDark(!dark)} onMobileMenu={() => setMobileOpen(true)} labels={availableLabels} notifications={notifications} readNotificationIds={readNotificationIds} onReadNotification={markNotificationRead} onOpenNotification={(notification) => { setActiveBoardLocal(notification.boardId); setActiveTaskId(notification.taskId); }} />
        <main className="board-view">
          <section className="board-header">
            <div className="board-title-block">
              <div className="board-icon" style={{ background: board.color }}><LayoutGrid size={20} /></div>
              <div><div className="board-title-row"><h1>{board.title}</h1>{access.canManageBoards && <button className="icon-button small" onClick={() => { setManagedBoardId(board.id); setBoardDialogOpen(true); }} aria-label="Настройки доски"><MoreHorizontal size={18} /></button>}</div><p>{board.description}</p></div>
            </div>
            <div className="board-summary">
              <div className={`stat saved ${saveError ? "save-failed" : ""}`} title={saveError ?? undefined}><HardDrive size={16} /><span>{saveError ? "Ошибка сохранения" : saving ? "Сохраняем…" : "Сохранено"}</span></div>
              {currentUser.role !== "guest" && <button className="button secondary team-button" onClick={() => setTeamOpen(true)} aria-label={`Активные сотрудники: ${Object.values(employees).filter((employee) => employee.status === "active").length}`}><UsersRound size={15} /><span>{Object.values(employees).filter((employee) => employee.status === "active").length} {pluralize(Object.values(employees).filter((employee) => employee.status === "active").length, ["сотрудник", "сотрудника", "сотрудников"])}</span></button>}
            </div>
          </section>
          <section className="view-toolbar">
            <div className="view-tabs"><button className={viewMode === "board" ? "active" : ""} onClick={() => setViewMode("board")}><LayoutGrid size={15} />Доска</button><button className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}><Rows3 size={15} />Список</button></div>
            <div className="toolbar-right">
              <div className="sort-select"><span>Сортировка</span><SelectMenu compact value={sort} ariaLabel="Сортировка" options={[{ value: "manual", label: "Вручную" }, { value: "due", label: "По дедлайну" }, { value: "priority", label: "По приоритету" }, { value: "title", label: "По названию" }]} onChange={(value) => setSort(value as typeof sort)} /></div>
              <button className={`icon-button ${compact ? "selected" : ""}`} onClick={() => setCompact(!compact)} aria-label="Переключить плотность" disabled={viewMode === "list"}><Rows3 size={17} /></button>
            </div>
          </section>
          {viewMode === "board" ? <BoardCanvas boardId={board.id} search={search} filters={filters} onOpenTask={setActiveTaskId} sort={sort} canEdit={access.canEditWorkspace} canEditDeadlines={access.canEditDeadlines} /> : <TaskTable boardId={board.id} search={search} filters={filters} onOpenTask={setActiveTaskId} sort={sort} />}
        </main>
      </div>
      {activeTaskId && <TaskModal key={activeTaskId} taskId={activeTaskId} onClose={() => setActiveTaskId(null)} canEdit={access.canEditWorkspace} canEditDeadlines={access.canEditDeadlines} currentUser={currentUser} />}
      {access.canEditWorkspace && <BoardDialog key={`${managedBoardId ?? "new"}-${boardDialogOpen}`} open={boardDialogOpen} boardId={managedBoardId} onClose={() => setBoardDialogOpen(false)} />}
      {currentUser.role !== "guest" && <TeamDialog open={teamOpen} onClose={() => setTeamOpen(false)} canManage={access.canManageEmployees} currentUserId={currentUser.id} />}
      <ArchiveDialog open={archiveOpen} onClose={() => setArchiveOpen(false)} canEdit={access.canEditWorkspace} />
      <Toaster theme={dark ? "dark" : "light"} position="bottom-right" richColors closeButton />
    </div>
  );
}
