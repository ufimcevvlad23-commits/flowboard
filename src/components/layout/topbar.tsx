"use client";

import { Bell, Filter, LogOut, Menu, Moon, Search, SlidersHorizontal, Sun, X } from "lucide-react";
import type { Filters, Priority, SessionUser, TaskStatus } from "@/types/board";
import { employeeInitials, priorityMeta, statusMeta } from "@/lib/utils";

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
  onNotifications: () => void;
}
export function Topbar({ currentUser, search, onSearch, filters, onFilters, filterOpen, onFilterOpen, dark, onThemeToggle, onMobileMenu, labels, onNotifications }: TopbarProps) {
  const activeCount = filters.priorities.length + filters.statuses.length + (filters.label ? 1 : 0) + (filters.due !== "all" ? 1 : 0);
  const toggle = <T extends string>(items: T[], value: T) => items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  };

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
              <div className="filter-group"><label>Статус</label><div className="chip-grid">
                {(Object.keys(statusMeta) as TaskStatus[]).map((value) => <button key={value} className={filters.statuses.includes(value) ? "active" : ""} onClick={() => onFilters({ ...filters, statuses: toggle(filters.statuses, value) })}>{statusMeta[value]}</button>)}
              </div></div>
              <div className="filter-group"><label htmlFor="label-filter">Метка</label><select id="label-filter" value={filters.label} onChange={(event) => onFilters({ ...filters, label: event.target.value })}><option value="">Любая</option>{labels.map((label) => <option value={label} key={label}>{label}</option>)}</select></div>
              <div className="filter-group"><label htmlFor="due-filter">Срок</label><select id="due-filter" value={filters.due} onChange={(event) => onFilters({ ...filters, due: event.target.value as Filters["due"] })}><option value="all">Любой</option><option value="overdue">Просрочено</option><option value="today">Сегодня</option><option value="week">На этой неделе</option></select></div>
            </div>
          )}
        </div>
        <button className="icon-button" onClick={onThemeToggle} aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        <button className="icon-button notification" onClick={onNotifications} aria-label="Уведомления"><Bell size={18} /></button>
        <div className="avatar top-avatar" title={`${currentUser.name} · ${currentUser.role === "admin" ? "Администратор" : currentUser.role === "guest" ? "Гость" : "Пользователь"}`}>{employeeInitials(currentUser.name)}</div>
        <button className="icon-button logout-button" onClick={() => void logout()} aria-label="Выйти из Flowboard" title="Выйти"><LogOut size={17} /></button>
      </div>
    </header>
  );
}
