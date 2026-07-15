"use client";

import { Archive, ChevronLeft, ChevronRight, LayoutDashboard, Plus, Settings2, Sparkles } from "lucide-react";
import { cn, employeeInitials } from "@/lib/utils";
import { useBoardStore } from "@/store/use-board-store";
import type { SessionUser } from "@/types/board";

interface SidebarProps {
  currentUser: SessionUser;
  canEdit: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onCreateBoard: () => void;
  onManageBoard: (id: string) => void;
  onOpenArchive: () => void;
}
export function Sidebar({ currentUser, canEdit, collapsed, onToggle, onCreateBoard, onManageBoard, onOpenArchive }: SidebarProps) {
  const boards = useBoardStore((state) => state.boards);
  const activeBoardId = useBoardStore((state) => state.activeBoardId);
  const setActiveBoard = useBoardStore((state) => state.setActiveBoard);
  const setActiveBoardLocal = useBoardStore((state) => state.setActiveBoardLocal);

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
        {canEdit && <button className="nav-item" onClick={onOpenArchive}><Archive size={18} /><span>Архив</span></button>}
      </nav>

      <div className="sidebar-section">
        {!collapsed && <div className="section-heading"><span>Рабочее пространство</span>{canEdit && <button className="icon-button" onClick={onCreateBoard} aria-label="Создать доску"><Plus size={15} /></button>}</div>}
        <div className="board-nav-list">
          {Object.values(boards).map((board) => (
            <div className={cn("board-nav-row", activeBoardId === board.id && "selected")} key={board.id}>
              <button className="board-nav-main" onClick={() => canEdit ? setActiveBoard(board.id) : setActiveBoardLocal(board.id)} title={board.title}>
                <span className="board-dot" style={{ background: board.color }} />
                <span>{board.title}</span>
              </button>
              {!collapsed && canEdit && <button className="board-settings" onClick={() => onManageBoard(board.id)} aria-label={`Настроить доску ${board.title}`}><Settings2 size={14} /></button>}
            </div>
          ))}
          {collapsed && canEdit && <button className="add-collapsed" onClick={onCreateBoard} aria-label="Создать доску"><Plus size={17} /></button>}
        </div>
      </div>

      {!collapsed && (
        <div className="sidebar-footer">
          <div className="avatar">{employeeInitials(currentUser.name)}</div>
          <div><strong>{currentUser.name}</strong><span>{currentUser.role === "admin" ? "Администратор" : currentUser.role === "guest" ? "Гость" : "Пользователь"}</span></div>
        </div>
      )}
    </aside>
  );
}
