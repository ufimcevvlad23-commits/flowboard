"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, addMonths, eachDayOfInterval, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value?: string;
  onChange: (value?: string) => void;
  disabled?: boolean;
  disabledReason?: string;
  compact?: boolean;
  iconOnly?: boolean;
}

const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function DatePicker({ value, onChange, disabled = false, disabledReason, compact = false, iconOnly = false }: DatePickerProps) {
  const selectedDate = value ? parseISO(value) : undefined;
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(selectedDate ?? today));
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number; visibility: "hidden" | "visible" }>({ top: 12, left: 12, width: 320, maxHeight: 400, visibility: "hidden" });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const monthStart = startOfMonth(visibleMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(addDays(gridStart, 35), { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const monthTitle = format(visibleMonth, "LLLL yyyy", { locale: ru }).replace(/^./, (letter) => letter.toLocaleUpperCase("ru"));

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      const popover = popoverRef.current;
      if (!rect || !popover) return;
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const safe = 12;
      const gap = 8;
      const width = Math.min(320, Math.max(1, viewportWidth - safe * 2));
      const measuredHeight = popover.scrollHeight;
      const maxHeight = Math.max(1, viewportHeight - safe * 2);
      const height = Math.min(measuredHeight, maxHeight);
      const belowTop = rect.bottom + gap;
      const aboveTop = rect.top - height - gap;
      const viewportBottom = viewportTop + viewportHeight;
      const top = belowTop + height <= viewportBottom - safe
        ? belowTop
        : aboveTop >= viewportTop + safe
          ? aboveTop
          : Math.max(viewportTop + safe, Math.min(belowTop, viewportBottom - height - safe));
      const left = Math.max(viewportLeft + safe, Math.min(rect.left, viewportLeft + viewportWidth - width - safe));
      setPosition({ top, left, width, maxHeight, visibility: "visible" });
    };
    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    const observedPopover = popoverRef.current;
    if (observedPopover) observer.observe(observedPopover);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape, true);
    };
  }, [open]);

  const selectDate = (date: Date) => {
    onChange(format(date, "yyyy-MM-dd"));
    setVisibleMonth(startOfMonth(date));
    setOpen(false);
  };

  const popover = open && typeof document !== "undefined" ? createPortal(
    <div ref={popoverRef} className="date-picker-popover" style={position} role="dialog" aria-label="Выбор даты">
      <div className="calendar-header">
        <div><span>Выберите дату</span><strong>{monthTitle}</strong></div>
        <div>
          <button type="button" onClick={() => setVisibleMonth((month) => addMonths(month, -1))} aria-label="Предыдущий месяц"><ChevronLeft size={17} /></button>
          <button type="button" onClick={() => setVisibleMonth((month) => addMonths(month, 1))} aria-label="Следующий месяц"><ChevronRight size={17} /></button>
        </div>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">{weekDays.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">
        {calendarDays.map((day) => {
          const selected = selectedDate ? isSameDay(day, selectedDate) : false;
          const current = isSameDay(day, today);
          return <button type="button" key={day.toISOString()} className={cn(!isSameMonth(day, visibleMonth) && "outside", current && "today", selected && "selected")} onClick={() => selectDate(day)} aria-label={format(day, "d MMMM yyyy", { locale: ru })} aria-pressed={selected}>{format(day, "d")}</button>;
        })}
      </div>
      <div className="calendar-footer">
        <button type="button" onClick={() => { onChange(undefined); setOpen(false); }} disabled={!value}>Очистить</button>
        <button type="button" className="today-button" onClick={() => selectDate(today)}>Сегодня</button>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className={cn("date-picker", compact && "compact", iconOnly && "icon-only")} ref={rootRef}>
      <button ref={triggerRef} type="button" className={cn("date-picker-trigger", open && "open", !value && "placeholder")} onClick={() => { setVisibleMonth(startOfMonth(selectedDate ?? today)); setPosition((current) => ({ ...current, visibility: "hidden" })); setOpen((current) => !current); }} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} title={disabled ? disabledReason : iconOnly ? selectedDate ? `Дедлайн: ${format(selectedDate, "dd.MM.yyyy")}` : "Назначить дедлайн" : undefined}>
        <CalendarDays size={16} />
        {!iconOnly && <span>{selectedDate ? format(selectedDate, compact ? "dd.MM" : "dd.MM.yyyy") : compact ? "Срок" : "Выберите дату"}</span>}
        {!iconOnly && <ChevronDown size={15} />}
      </button>
      {popover}
    </div>
  );
}
