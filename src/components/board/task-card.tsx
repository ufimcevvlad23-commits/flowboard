"use client";
/* eslint-disable react-hooks/refs -- dnd-kit exposes callback refs/listeners for render by design */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, Archive, CalendarDays, CheckSquare2, CircleCheck, MessageSquare, Paperclip, Pin, PinOff, RotateCcw, UsersRound } from "lucide-react";
import { format, isBefore, isToday, startOfToday } from "date-fns";
import { ru } from "date-fns/locale";
import { cn, priorityMeta } from "@/lib/utils";
import { useBoardStore } from "@/store/use-board-store";
import type { Task } from "@/types/board";

interface TaskCardProps {
  task: Task;
  listId: string;
  onOpen: (id: string) => void;
  overlay?: boolean;
  canEdit: boolean;
}

export function TaskCard({ task, listId, onOpen, overlay = false, canEdit }: TaskCardProps) {
  const updateTask = useBoardStore((state) => state.updateTask);
  const toggleTaskClosed = useBoardStore((state) => state.toggleTaskClosed);
  const employees = useBoardStore((state) => state.employees);
  const sortable = useSortable({ id: task.id, data: { type: "task", listId }, disabled: overlay || !canEdit });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  const overdue = task.dueDate && isBefore(new Date(`${task.dueDate}T23:59:59`), startOfToday()) && task.status !== "done" && !task.closed;
  const assignees = (task.assigneeIds ?? []).map((id) => employees[id]).filter(Boolean);
  const checklist = task.checklist ?? [];
  const checklistDone = checklist.filter((item) => item.completed).length;
  const checklistOverdue = checklist.filter((item) => item.dueDate && !item.completed && isBefore(new Date(`${item.dueDate}T23:59:59`), startOfToday())).length;

  return (
    <article
      ref={sortable.setNodeRef}
      style={style}
      className={cn("task-card", sortable.isDragging && "dragging", overlay && "overlay-card", task.pinned && "pinned", task.closed && "closed")}
      {...sortable.attributes}
      {...sortable.listeners}
      role="article"
      onClick={() => onOpen(task.id)}
      tabIndex={0}
      onKeyDown={(event) => event.key === "Enter" && onOpen(task.id)}
      aria-label={`Открыть задачу ${task.title}`}
    >
      <div className="card-priority" style={{ background: priorityMeta[task.priority].color }} />
      {canEdit && <div className="card-quick-actions">
        <button onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); updateTask(task.id, { pinned: !task.pinned }); }} aria-label={task.pinned ? "Открепить" : "Закрепить"}>{task.pinned ? <PinOff size={13} /> : <Pin size={13} />}</button>
        <button onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); toggleTaskClosed(task.id); }} aria-label={task.closed ? "Открыть задачу снова" : "Закрыть задачу"}>{task.closed ? <RotateCcw size={13} /> : <CircleCheck size={13} />}</button>
        <button onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); updateTask(task.id, { archived: true }); }} aria-label="Архивировать"><Archive size={13} /></button>
      </div>}
      {task.labels.length > 0 && <div className="label-row">{task.labels.slice(0, 3).map((label, index) => <span key={label} className={`label-color-${index % 4}`}>{label}</span>)}</div>}
      {task.closed && <span className="closed-badge"><CircleCheck size={12} />Закрыта</span>}
      <h3>{task.title}</h3>
      {checklist.length > 0 && <div className={cn("card-checklist-line", checklistDone === checklist.length && "complete", checklistOverdue > 0 && "has-overdue")}><CheckSquare2 size={13} /><span>{checklistDone} из {checklist.length}</span><i><b style={{ width: `${Math.round((checklistDone / checklist.length) * 100)}%` }} /></i>{checklistOverdue > 0 && <em title={`Просрочено пунктов: ${checklistOverdue}`}><AlertTriangle size={12} />{checklistOverdue}</em>}</div>}
      {assignees.length > 0 && <div className="card-assignee-line" title={assignees.map((employee) => employee.name).join(", ")}><UsersRound size={13} /><span>{assignees.slice(0, 2).map((employee) => employee.name).join(", ")}{assignees.length > 2 && ` +${assignees.length - 2}`}</span></div>}
      <div className="task-card-footer">
        <div className="card-meta">
          {task.dueDate && <span className={cn("due-chip", overdue && "overdue", isToday(new Date(`${task.dueDate}T12:00:00`)) && "today")}><CalendarDays size={13} />{format(new Date(`${task.dueDate}T12:00:00`), "d MMM", { locale: ru })}</span>}
          {task.comments.length > 0 && <span><MessageSquare size={13} />{task.comments.length}</span>}
          {task.notes && <span><Paperclip size={13} />1</span>}
        </div>
        <span className={cn("task-check", (task.status === "done" || task.closed || (checklist.length > 0 && checklistDone === checklist.length)) && "done")}><CheckSquare2 size={15} /></span>
      </div>
    </article>
  );
}
