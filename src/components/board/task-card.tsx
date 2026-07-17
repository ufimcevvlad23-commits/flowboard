"use client";
/* eslint-disable react-hooks/refs -- dnd-kit exposes callback refs/listeners for render by design */

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, Check, CheckSquare2, CircleCheck, MessageSquare, Pencil, RotateCcw, UserPlus } from "lucide-react";
import { isBefore, startOfToday } from "date-fns";
import { DatePicker } from "@/components/ui/date-picker";
import { cn, employeeColor, employeeInitials, priorityMeta } from "@/lib/utils";
import { useBoardStore } from "@/store/use-board-store";
import type { Task } from "@/types/board";

interface TaskCardProps {
  task: Task;
  listId: string;
  onOpen: (id: string) => void;
  overlay?: boolean;
  canEdit: boolean;
  canEditDeadlines?: boolean;
}

export function TaskCard({ task, listId, onOpen, overlay = false, canEdit, canEditDeadlines = canEdit }: TaskCardProps) {
  const updateTask = useBoardStore((state) => state.updateTask);
  const toggleTaskClosed = useBoardStore((state) => state.toggleTaskClosed);
  const employees = useBoardStore((state) => state.employees);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const sortable = useSortable({ id: task.id, data: { type: "task", listId }, disabled: overlay || !canEdit || editingTitle || assigneeOpen });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  const assignees = (task.assigneeIds ?? []).map((id) => employees[id]).filter(Boolean);
  const employeeList = Object.values(employees).filter((employee) => employee.status === "active").sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const checklist = task.checklist ?? [];
  const checklistDone = checklist.filter((item) => item.completed).length;
  const checklistOverdue = checklist.filter((item) => item.dueDate && !item.completed && isBefore(new Date(`${item.dueDate}T23:59:59`), startOfToday())).length;

  const finishTitleEdit = () => {
    const next = title.trim();
    if (next && next !== task.title) updateTask(task.id, { title: next });
    else setTitle(task.title);
    setEditingTitle(false);
  };

  return (
    <article
      ref={sortable.setNodeRef}
      style={style}
      className={cn("task-card", sortable.isDragging && "dragging", overlay && "overlay-card", task.closed && "closed")}
      {...sortable.attributes}
      {...sortable.listeners}
      role="article"
      onClick={() => !editingTitle && !assigneeOpen && onOpen(task.id)}
      tabIndex={0}
      onKeyDown={(event) => event.key === "Enter" && !editingTitle && onOpen(task.id)}
      aria-label={`Открыть задачу ${task.title}`}
    >
      <div className="card-priority" style={{ background: priorityMeta[task.priority].color }} />
      {canEdit && <div className="card-quick-actions">
        <button onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setTitle(task.title); setEditingTitle(true); }} aria-label="Изменить название задачи"><Pencil size={13} /></button>
      </div>}
      {task.labels.length > 0 && <div className="label-row">{task.labels.slice(0, 3).map((label, index) => <span key={label} className={`label-color-${index % 4}`}>{label}</span>)}</div>}
      {task.closed && <span className="closed-badge"><CircleCheck size={12} />Закрыта</span>}
      {editingTitle ? <input className="card-title-input" autoFocus value={title} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onChange={(event) => setTitle(event.target.value)} onBlur={finishTitleEdit} onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Enter") finishTitleEdit(); if (event.key === "Escape") { setTitle(task.title); setEditingTitle(false); } }} aria-label="Название задачи" /> : <h3 title={task.title}>{task.title}</h3>}
      {checklist.length > 0 && <div className={cn("card-checklist-line", checklistDone === checklist.length && "complete", checklistOverdue > 0 && "has-overdue")}><CheckSquare2 size={13} /><span>{checklistDone}/{checklist.length}</span><i><b style={{ width: `${Math.round((checklistDone / checklist.length) * 100)}%` }} /></i>{checklistOverdue > 0 && <em title={`Просрочено пунктов: ${checklistOverdue}`}><AlertTriangle size={12} />{checklistOverdue}</em>}</div>}
      <div className="task-card-footer">
        <div className="card-assignee-picker" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <button type="button" className="card-assignee-trigger" disabled={!canEdit} onClick={() => setAssigneeOpen((open) => !open)} aria-label="Выбрать ответственных" aria-expanded={assigneeOpen}>
            {assignees.slice(0, 2).map((employee) => <span key={employee.id} className="employee-avatar card-avatar" style={{ background: employeeColor(employee.id) }}>{employeeInitials(employee.name)}</span>)}
            {assignees.length > 2 && <b>+{assignees.length - 2}</b>}
            {assignees.length === 0 && <UserPlus size={14} />}
          </button>
          {assigneeOpen && <div className="card-assignee-popover"><strong>Ответственные</strong>{employeeList.map((employee) => { const selected = task.assigneeIds.includes(employee.id); return <button type="button" key={employee.id} className={selected ? "selected" : ""} onClick={() => updateTask(task.id, { assigneeIds: selected ? task.assigneeIds.filter((id) => id !== employee.id) : [...task.assigneeIds, employee.id] })}><span className="employee-avatar" style={{ background: employeeColor(employee.id) }}>{employeeInitials(employee.name)}</span><span>{employee.name}</span>{selected && <Check size={13} />}</button>; })}</div>}
        </div>
        <div className="card-meta">
          <div onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}><DatePicker compact value={task.dueDate} onChange={(dueDate) => updateTask(task.id, { dueDate })} disabled={!canEdit || !canEditDeadlines} disabledReason={!canEdit ? "Доступен только просмотр" : "Нет права изменять дедлайны"} /></div>
          {task.comments.length > 0 && <span><MessageSquare size={13} />{task.comments.length}</span>}
          {canEdit && <button type="button" className={cn("card-complete", task.closed && "done")} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); toggleTaskClosed(task.id); }} aria-label={task.closed ? "Открыть задачу снова" : "Завершить задачу"}>{task.closed ? <RotateCcw size={14} /> : <CheckSquare2 size={15} />}</button>}
        </div>
      </div>
    </article>
  );
}
