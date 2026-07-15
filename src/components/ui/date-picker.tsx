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
}

const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function DatePicker({ value, onChange }: DatePickerProps) {
  const selectedDate = value ? parseISO(value) : undefined;
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(selectedDate ?? today));
  const [position, setPosition] = useState({ top: 0, left: 0, width: 320 });
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
      if (!rect) return;
      const width = Math.min(320, window.innerWidth - 24);
      const estimatedHeight = 356;
      const below = window.innerHeight - rect.bottom;
      const top = below >= estimatedHeight + 10 ? rect.bottom + 8 : Math.max(12, rect.top - estimatedHeight - 8);
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      setPosition({ top, left, width });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
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
    <div className="date-picker" ref={rootRef}>
      <button ref={triggerRef} type="button" className={cn("date-picker-trigger", open && "open", !value && "placeholder")} onClick={() => { setVisibleMonth(startOfMonth(selectedDate ?? today)); setOpen((current) => !current); }} aria-haspopup="dialog" aria-expanded={open}>
        <CalendarDays size={16} />
        <span>{selectedDate ? format(selectedDate, "dd.MM.yyyy") : "Выберите дату"}</span>
        <ChevronDown size={15} />
      </button>
      {popover}
    </div>
  );
}
