"use client";

import { Archive, ChevronLeft, ChevronRight, LayoutDashboard, Plus, Settings2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/store/use-board-store";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onCreateBoard: () => void;
  onManageBoard: (id: string) => void;
  onOpenArchive: () => void;
}
export function Sidebar({ collapsed, onToggle, onCreateBoard, onManageBoard, onOpenArchive }: SidebarProps) {
  const boards = useBoardStore((state) => state.boards);
  const activeBoardId = useBoardStore((state) => state.activeBoardId);
  const setActiveBoard = useBoardStore((state) => state.setActiveBoard);

  return (
    <aside className={cn("sidebar", collapsed && "collapsed")}>
      <div className="brand-row">
        <div className="brand-mark"><Sparkles size={18} /></div>
        {!collapsed && <span className="brand-name">Flowboard</span>}
        <button className="icon-button sidebar-toggle" onClick={onToggle} aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}>
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Основная навигация">
        <div className="nav-item active"><LayoutDashboard size={18} /><span>Мои доски</span></div>
        <button className="nav-item" onClick={onOpenArchive}><Archive size={18} /><span>Архив</span></button>
      </nav>

      <div className="sidebar-section">
        {!collapsed && <div className="section-heading"><span>Рабочее пространство</span><button className="icon-button" onClick={onCreateBoard} aria-label="Создать доску"><Plus size={15} /></button></div>}
        <div className="board-nav-list">
          {Object.values(boards).map((board) => (
            <div className={cn("board-nav-row", activeBoardId === board.id && "selected")} key={board.id}>
              <button className="board-nav-main" onClick={() => setActiveBoard(board.id)} title={board.title}>
                <span className="board-dot" style={{ background: board.color }} />
                <span>{board.title}</span>
              </button>
              {!collapsed && <button className="board-settings" onClick={() => onManageBoard(board.id)} aria-label={`Настроить доску ${board.title}`}><Settings2 size={14} /></button>}
            </div>
          ))}
          {collapsed && <button className="add-collapsed" onClick={onCreateBoard} aria-label="Создать доску"><Plus size={17} /></button>}
        </div>
      </div>

      {!collapsed && (
        <div className="sidebar-footer">
          <div className="avatar">УФ</div>
          <div><strong>Ваше пространство</strong><span>Локальная версия</span></div>
        </div>
      )}
    </aside>
  );
}
