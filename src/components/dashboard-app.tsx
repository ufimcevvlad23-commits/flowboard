"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { BarChart3, CheckCircle2, ChevronDown, LayoutGrid, MoreHorizontal, Plus, Rows3, Users } from "lucide-react";
import { Toaster, toast } from "sonner";
import { ArchiveDialog } from "@/components/board/archive-dialog";
import { BoardCanvas } from "@/components/board/board-canvas";
import { BoardDialog } from "@/components/board/board-dialog";
import { TaskModal } from "@/components/board/task-modal";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useBoardStore } from "@/store/use-board-store";
import type { Filters } from "@/types/board";

const defaultFilters: Filters = { priorities: [], statuses: [], label: "", due: "all" };

export function DashboardApp() {
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [dark, setDark] = useState(() => typeof window === "undefined" ? true : localStorage.getItem("flowboard-theme") !== "light");
  const [compact, setCompact] = useState(false);
  const [sort, setSort] = useState<"manual" | "due" | "priority" | "title">("manual");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [boardDialogOpen, setBoardDialogOpen] = useState(false);
  const [managedBoardId, setManagedBoardId] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const activeBoardId = useBoardStore((state) => state.activeBoardId);
  const board = useBoardStore((state) => state.boards[activeBoardId]);
  const lists = useBoardStore((state) => state.lists);
  const tasks = useBoardStore((state) => state.tasks);

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

  const stats = useMemo(() => {
    const boardTasks = board?.listIds.flatMap((id) => lists[id]?.taskIds ?? []).map((id) => tasks[id]).filter((task) => task && !task.archived) ?? [];
    return { total: boardTasks.length, done: boardTasks.filter((task) => task.status === "done").length };
  }, [board, lists, tasks]);

  if (!mounted) return <div className="app-loading"><div className="loading-logo">F</div><div className="loading-line" /><span>Загружаем рабочее пространство…</span></div>;

  if (!board) return (
    <main className="empty-workspace"><div className="brand-mark large">F</div><h1>Создайте первую доску</h1><p>Организуйте проект в списках и двигайте задачи к результату.</p><button className="button primary" onClick={() => { setManagedBoardId(null); setBoardDialogOpen(true); }}><Plus size={16} />Создать доску</button><BoardDialog key={`new-${boardDialogOpen}`} open={boardDialogOpen} boardId={null} onClose={() => setBoardDialogOpen(false)} /></main>
  );

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-is-collapsed" : ""} ${compact ? "compact-mode" : ""} ${mobileOpen ? "mobile-sidebar-open" : ""}`}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} onCreateBoard={() => { setManagedBoardId(null); setBoardDialogOpen(true); }} onManageBoard={(id) => { setManagedBoardId(id); setBoardDialogOpen(true); }} onOpenArchive={() => setArchiveOpen(true)} />
      {mobileOpen && <button className="mobile-overlay" onClick={() => setMobileOpen(false)} aria-label="Закрыть меню" />}
      <div className="workspace">
        <Topbar search={search} onSearch={setSearch} filters={filters} onFilters={setFilters} filterOpen={filterOpen} onFilterOpen={setFilterOpen} dark={dark} onThemeToggle={() => setDark(!dark)} onMobileMenu={() => setMobileOpen(true)} />
        <main className="board-view">
          <section className="board-header">
            <div className="board-title-block">
              <div className="board-icon" style={{ background: board.color }}><LayoutGrid size={20} /></div>
              <div><div className="board-title-row"><h1>{board.title}</h1><button className="icon-button small" onClick={() => { setManagedBoardId(board.id); setBoardDialogOpen(true); }} aria-label="Настройки доски"><MoreHorizontal size={18} /></button></div><p>{board.description}</p></div>
            </div>
            <div className="board-summary">
              <div className="stat"><BarChart3 size={16} /><span><b>{stats.total}</b> задач</span></div>
              <div className="stat success"><CheckCircle2 size={16} /><span><b>{stats.done}</b> готово</span></div>
              <div className="member-stack"><span>А</span><span>М</span><span>К</span><button><Plus size={13} /></button></div>
              <button className="button secondary invite-button" onClick={() => toast.info("Совместная работа появится при подключении backend")}><Users size={15} />Поделиться</button>
            </div>
          </section>
          <section className="view-toolbar">
            <div className="view-tabs"><button className="active"><LayoutGrid size={15} />Доска</button><button onClick={() => toast.info("Режим таблицы запланирован")}><Rows3 size={15} />Список</button></div>
            <div className="toolbar-right">
              <label className="sort-select">Сортировка<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="manual">Вручную</option><option value="due">По дедлайну</option><option value="priority">По приоритету</option><option value="title">По названию</option></select><ChevronDown size={14} /></label>
              <button className={`icon-button ${compact ? "selected" : ""}`} onClick={() => setCompact(!compact)} aria-label="Переключить плотность"><Rows3 size={17} /></button>
            </div>
          </section>
          <BoardCanvas boardId={board.id} search={search} filters={filters} onOpenTask={setActiveTaskId} sort={sort} />
        </main>
      </div>
      {activeTaskId && <TaskModal key={activeTaskId} taskId={activeTaskId} onClose={() => setActiveTaskId(null)} />}
      <BoardDialog key={`${managedBoardId ?? "new"}-${boardDialogOpen}`} open={boardDialogOpen} boardId={managedBoardId} onClose={() => setBoardDialogOpen(false)} />
      <ArchiveDialog open={archiveOpen} onClose={() => setArchiveOpen(false)} />
      <Toaster theme={dark ? "dark" : "light"} position="bottom-right" richColors closeButton />
    </div>
  );
}
