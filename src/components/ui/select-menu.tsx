"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectMenuOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectMenuProps {
  value: string;
  options: SelectMenuOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

export function SelectMenu({ value, options, onChange, ariaLabel, disabled = false, className, compact = false }: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 12, left: 12, width: 220, maxHeight: 280, visibility: "hidden" as "hidden" | "visible" });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

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
      const gap = 7;
      const width = Math.min(Math.max(rect.width, 180), Math.max(1, viewportWidth - safe * 2));
      const maxHeight = Math.max(1, Math.min(320, viewportHeight - safe * 2));
      const height = Math.min(popover.scrollHeight, maxHeight);
      const belowTop = rect.bottom + gap;
      const aboveTop = rect.top - height - gap;
      const viewportBottom = viewportTop + viewportHeight;
      const top = belowTop + height <= viewportBottom - safe ? belowTop : aboveTop >= viewportTop + safe ? aboveTop : Math.max(viewportTop + safe, viewportBottom - height - safe);
      const left = Math.max(viewportLeft + safe, Math.min(rect.left, viewportLeft + viewportWidth - width - safe));
      setPosition({ top, left, width, maxHeight, visibility: "visible" });
    };
    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    if (popoverRef.current) observer.observe(popoverRef.current);
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
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape, true);
    };
  }, [open]);

  const popover = open && typeof document !== "undefined" ? createPortal(
    <div ref={popoverRef} className="select-menu-popover" style={position} role="listbox" aria-label={ariaLabel}>
      <div className="select-menu-heading">Выберите значение</div>
      <div className="select-menu-options">
        {options.map((option) => <button type="button" role="option" aria-selected={option.value === value} className={cn(option.value === value && "selected")} key={option.value} onClick={() => { onChange(option.value); setOpen(false); triggerRef.current?.focus(); }}><span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>{option.value === value && <Check size={15} />}</button>)}
      </div>
    </div>,
    document.body,
  ) : null;

  return <div className={cn("select-menu", compact && "compact", className)}>
    <button ref={triggerRef} type="button" className={cn("select-menu-trigger", open && "open")} onClick={() => { setPosition((current) => ({ ...current, visibility: "hidden" })); setOpen((current) => !current); }} disabled={disabled} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open}>
      <span>{selected?.label ?? "Выберите"}</span><ChevronDown size={15} />
    </button>
    {popover}
  </div>;
}
