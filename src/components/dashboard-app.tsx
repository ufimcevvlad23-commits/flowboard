"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { BarChart3, CheckCircle2, ChevronDown, Download, HardDrive, LayoutGrid, MoreHorizontal, Plus, Rows3, UsersRound } from "lucide-react";
import { Toaster, toast } from "sonner";
import { ArchiveDialog } from "@/components/board/archive-dialog";
import { BoardCanvas } from "@/components/board/board-canvas";
import { BoardDialog } from "@/components/board/board-dialog";
import { TaskModal } from "@/components/board/task-modal";
import { TaskTable } from "@/components/board/task-table";
import { TeamDialog } from "@/components/board/team-dialog";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
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
  const activeBoardId = useBoardStore((state) => state.activeBoardId);
  const board = useBoardStore((state) => state.boards[activeBoardId]);
  const lists = useBoardStore((state) => state.lists);
  const tasks = useBoardStore((state) => state.tasks);
  const employees = useBoardStore((state) => state.employees);
  const hydrated = useBoardStore((state) => state.hydrated);
  const saving = useBoardStore((state) => state.saving);
  const saveError = useBoardStore((state) => state.saveError);
  const hydrateWorkspace = useBoardStore((state) => state.hydrateWorkspace);

  useEffect(() => {
    hydrateWorkspace(initialSnapshot);
  }, [hydrateWorkspace, initialSnapshot]);

  useEffect(() => {
    const verify = async () => {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (response.status === 401) window.location.assign("/login");
      if (response.ok) {
        const result = await response.json() as { user?: SessionUser };
        if (result.user && (result.user.role !== currentUser.role || result.user.canEditDeadlines !== currentUser.canEditDeadlines)) window.location.reload();
      }
    };
    const interval = window.setInterval(() => void verify(), 10_000);
    const onVisibility = () => document.visibilityState === "visible" && void verify();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisibility); };
  }, [currentUser.canEditDeadlines, currentUser.role]);

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
  const stats = useMemo(() => {
    return { total: boardTasks.length, done: boardTasks.filter((task) => task.status === "done").length };
  }, [boardTasks]);
  const availableLabels = useMemo(() => {
    return [...new Set(boardTasks.flatMap((task) => task.labels))].sort((a, b) => a.localeCompare(b, "ru"));
  }, [boardTasks]);

  const exportWorkspace = () => {
    const { boards, lists: allLists, tasks: allTasks, employees: allEmployees, activeBoardId: currentBoardId } = useBoardStore.getState();
    const payload = JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), activeBoardId: currentBoardId, boards, lists: allLists, tasks: allTasks, employees: allEmployees }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `flowboard-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Резервная копия скачана");
  };

  if (!mounted || !hydrated) return <div className="app-loading"><div className="loading-logo">F</div><div className="loading-line" /><span>Загружаем защищённое рабочее пространство…</span></div>;

  if (!board) return (
    <main className="empty-workspace"><div className="brand-mark large">F</div><h1>{access.canEditWorkspace ? "Создайте первую доску" : "Нет доступных досок"}</h1><p>{access.canEditWorkspace ? "Организуйте проект в списках и двигайте задачи к результату." : "Попросите администратора добавить доску или изменить ваш уровень доступа."}</p>{access.canEditWorkspace && <><button className="button primary" onClick={() => { setManagedBoardId(null); setBoardDialogOpen(true); }}><Plus size={16} />Создать доску</button><BoardDialog key={`new-${boardDialogOpen}`} open={boardDialogOpen} boardId={null} onClose={() => setBoardDialogOpen(false)} /></>}</main>
  );

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-is-collapsed" : ""} ${compact ? "compact-mode" : ""} ${mobileOpen ? "mobile-sidebar-open" : ""}`}>
      <Sidebar currentUser={currentUser} canEdit={access.canEditWorkspace} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} onCreateBoard={() => { setManagedBoardId(null); setBoardDialogOpen(true); }} onManageBoard={(id) => { setManagedBoardId(id); setBoardDialogOpen(true); }} onOpenArchive={() => setArchiveOpen(true)} />
      {mobileOpen && <button className="mobile-overlay" onClick={() => setMobileOpen(false)} aria-label="Закрыть меню" />}
      <div className="workspace">
        <Topbar currentUser={currentUser} search={search} onSearch={setSearch} filters={filters} onFilters={setFilters} filterOpen={filterOpen} onFilterOpen={setFilterOpen} dark={dark} onThemeToggle={() => setDark(!dark)} onMobileMenu={() => setMobileOpen(true)} labels={availableLabels} onNotifications={() => toast.info("Новых уведомлений нет")} />
        <main className="board-view">
          <section className="board-header">
            <div className="board-title-block">
              <div className="board-icon" style={{ background: board.color }}><LayoutGrid size={20} /></div>
              <div><div className="board-title-row"><h1>{board.title}</h1>{access.canEditWorkspace && <button className="icon-button small" onClick={() => { setManagedBoardId(board.id); setBoardDialogOpen(true); }} aria-label="Настройки доски"><MoreHorizontal size={18} /></button>}</div><p>{board.description}</p></div>
            </div>
            <div className="board-summary">
              <div className="stat"><BarChart3 size={16} /><span><b>{stats.total}</b> {pluralize(stats.total, ["задача", "задачи", "задач"])}</span></div>
              <div className="stat success"><CheckCircle2 size={16} /><span><b>{stats.done}</b> {pluralize(stats.done, ["готова", "готовы", "готово"])}</span></div>
              <div className={`stat saved ${saveError ? "save-failed" : ""}`} title={saveError ?? undefined}><HardDrive size={16} /><span>{saveError ? "Ошибка сохранения" : saving ? "Сохраняем…" : "Сохранено"}</span></div>
              {currentUser.role !== "guest" && <button className="button secondary team-button" onClick={() => setTeamOpen(true)} aria-label={`Активные сотрудники: ${Object.values(employees).filter((employee) => employee.status === "active").length}`}><UsersRound size={15} /><span>{Object.values(employees).filter((employee) => employee.status === "active").length} {pluralize(Object.values(employees).filter((employee) => employee.status === "active").length, ["сотрудник", "сотрудника", "сотрудников"])}</span></button>}
              {access.canEditWorkspace && <button className="button secondary invite-button" onClick={exportWorkspace}><Download size={15} />Экспорт</button>}
            </div>
          </section>
          <section className="view-toolbar">
            <div className="view-tabs"><button className={viewMode === "board" ? "active" : ""} onClick={() => setViewMode("board")}><LayoutGrid size={15} />Доска</button><button className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}><Rows3 size={15} />Список</button></div>
            <div className="toolbar-right">
              <label className="sort-select">Сортировка<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="manual">Вручную</option><option value="due">По дедлайну</option><option value="priority">По приоритету</option><option value="title">По названию</option></select><ChevronDown size={14} /></label>
              <button className={`icon-button ${compact ? "selected" : ""}`} onClick={() => setCompact(!compact)} aria-label="Переключить плотность" disabled={viewMode === "list"}><Rows3 size={17} /></button>
            </div>
          </section>
          {viewMode === "board" ? <BoardCanvas boardId={board.id} search={search} filters={filters} onOpenTask={setActiveTaskId} sort={sort} canEdit={access.canEditWorkspace} /> : <TaskTable boardId={board.id} search={search} filters={filters} onOpenTask={setActiveTaskId} sort={sort} />}
        </main>
      </div>
      {activeTaskId && <TaskModal key={activeTaskId} taskId={activeTaskId} onClose={() => setActiveTaskId(null)} canEdit={access.canEditWorkspace} canEditDeadlines={access.canEditDeadlines} />}
      {access.canEditWorkspace && <BoardDialog key={`${managedBoardId ?? "new"}-${boardDialogOpen}`} open={boardDialogOpen} boardId={managedBoardId} onClose={() => setBoardDialogOpen(false)} />}
      {currentUser.role !== "guest" && <TeamDialog open={teamOpen} onClose={() => setTeamOpen(false)} canManage={access.canManageEmployees} currentUserId={currentUser.id} />}
      <ArchiveDialog open={archiveOpen} onClose={() => setArchiveOpen(false)} canEdit={access.canEditWorkspace} />
      <Toaster theme={dark ? "dark" : "light"} position="bottom-right" richColors closeButton />
    </div>
  );
}
