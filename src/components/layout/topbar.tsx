"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, AtSign, Bell, CalendarClock, Filter, LogOut, Menu, Moon, Search, SlidersHorizontal, Sun, X } from "lucide-react";
import { SelectMenu } from "@/components/ui/select-menu";
import type { Filters, Priority, SessionUser } from "@/types/board";
import { employeeInitials, priorityMeta } from "@/lib/utils";

export interface TaskNotification {
  id: string;
  kind: "overdue" | "soon" | "mention";
  title: string;
  detail: string;
  taskId: string;
  boardId: string;
}

interface TopbarProps {
  currentUser: SessionUser;
  search: string;
  onSearch: (value: string) => void;
  filters: Filters;
  onFilters: (filters: Filters) => void;
  filterOpen: boolean;
  onFilterOpen: (value: boolean) => void;
  dark: boolean;
  onThemeToggle: () => void;
  onMobileMenu: () => void;
  labels: string[];
  notifications: TaskNotification[];
  onOpenNotification: (notification: TaskNotification) => void;
}
export function Topbar({ currentUser, search, onSearch, filters, onFilters, filterOpen, onFilterOpen, dark, onThemeToggle, onMobileMenu, labels, notifications, onOpenNotification }: TopbarProps) {
  const [notificationOpen, setNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const activeCount = filters.priorities.length + (filters.label ? 1 : 0) + (filters.due !== "all" ? 1 : 0);
  const toggle = <T extends string>(items: T[], value: T) => items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  };
  useEffect(() => {
    if (!notificationOpen) return;
    const closeOutside = (event: PointerEvent) => { if (!notificationRef.current?.contains(event.target as Node)) setNotificationOpen(false); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setNotificationOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, [notificationOpen]);

  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" onClick={onMobileMenu} aria-label="Открыть меню"><Menu size={19} /></button>
      <label className="search-box">
        <Search size={17} />
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Поиск задач и списков..." aria-label="Поиск" />
        {search && <button onClick={() => onSearch("")} aria-label="Очистить поиск"><X size={15} /></button>}
        <kbd>⌘ K</kbd>
      </label>
      <div className="topbar-actions">
        <div className="filter-wrap">
          <button className="toolbar-button" onClick={() => onFilterOpen(!filterOpen)} aria-expanded={filterOpen}>
            <SlidersHorizontal size={16} /><span>Фильтры</span>{activeCount > 0 && <b>{activeCount}</b>}
          </button>
          {filterOpen && (
            <div className="filter-popover">
              <div className="popover-title"><span><Filter size={15} /> Фильтры</span>{activeCount > 0 && <button onClick={() => onFilters({ priorities: [], statuses: [], label: "", due: "all" })}>Сбросить</button>}</div>
              <div className="filter-group"><label>Приоритет</label><div className="chip-grid">
                {(Object.keys(priorityMeta) as Priority[]).map((value) => <button key={value} className={filters.priorities.includes(value) ? "active" : ""} onClick={() => onFilters({ ...filters, priorities: toggle(filters.priorities, value) })}>{priorityMeta[value].label}</button>)}
              </div></div>
              <div className="filter-group"><label>Тег</label><SelectMenu compact value={filters.label} ariaLabel="Фильтр по тегу" options={[{ value: "", label: "Любой" }, ...labels.map((label) => ({ value: label, label }))]} onChange={(value) => onFilters({ ...filters, label: value })} /></div>
              <div className="filter-group"><label>Срок</label><SelectMenu compact value={filters.due} ariaLabel="Фильтр по сроку" options={[{ value: "all", label: "Любой" }, { value: "overdue", label: "Просрочено" }, { value: "today", label: "Сегодня" }, { value: "week", label: "На этой неделе" }]} onChange={(value) => onFilters({ ...filters, due: value as Filters["due"] })} /></div>
            </div>
          )}
        </div>
        <button className="icon-button" onClick={onThemeToggle} aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        <div className="notification-wrap" ref={notificationRef}>
          <button className="icon-button notification" onClick={() => setNotificationOpen((current) => !current)} aria-label="Уведомления" aria-expanded={notificationOpen}><Bell size={18} />{notifications.length > 0 && <b>{Math.min(notifications.length, 99)}</b>}</button>
          {notificationOpen && <div className="notification-popover"><div className="notification-heading"><span><Bell size={15} />Уведомления</span><b>{notifications.length}</b></div><div className="notification-list">{notifications.map((notification) => <button type="button" className={`notification-item ${notification.kind}`} key={notification.id} onClick={() => { setNotificationOpen(false); onOpenNotification(notification); }}>{notification.kind === "mention" ? <AtSign size={16} /> : notification.kind === "overdue" ? <AlertTriangle size={16} /> : <CalendarClock size={16} />}<span><strong>{notification.title}</strong><small>{notification.detail}</small></span></button>)}{notifications.length === 0 && <div className="notification-empty"><Bell size={22} /><strong>Всё спокойно</strong><span>Новых уведомлений нет</span></div>}</div></div>}
        </div>
        <div className="avatar top-avatar" title={`${currentUser.name} · ${currentUser.role === "admin" ? "Администратор" : currentUser.role === "guest" ? "Гость" : "Пользователь"}`}>{employeeInitials(currentUser.name)}</div>
        <button className="icon-button logout-button" onClick={() => void logout()} aria-label="Выйти из Flowboard" title="Выйти"><LogOut size={17} /></button>
      </div>
    </header>
  );
}
