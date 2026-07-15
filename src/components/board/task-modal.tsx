"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Archive, CalendarClock, Check, CircleCheck, Eye, ListChecks, MessageSquare, Pin, Plus, RotateCcw, Trash2, UserRoundCheck } from "lucide-react";
import { formatDistanceToNow, isBefore, startOfToday } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { DatePicker } from "@/components/ui/date-picker";
import { cn, employeeColor, employeeInitials, priorityMeta, statusMeta, uid } from "@/lib/utils";
import { useBoardStore } from "@/store/use-board-store";
import type { ChecklistItem, Priority, TaskDraft, TaskStatus } from "@/types/board";

interface TaskModalProps {
  taskId: string;
  onClose: () => void;
  canEdit: boolean;
  canEditDeadlines: boolean;
}

export function TaskModal({ taskId, onClose, canEdit, canEditDeadlines }: TaskModalProps) {
  const task = useBoardStore((state) => taskId ? state.tasks[taskId] : undefined);
  const updateTask = useBoardStore((state) => state.updateTask);
  const deleteTask = useBoardStore((state) => state.deleteTask);
  const addComment = useBoardStore((state) => state.addComment);
  const toggleTaskClosed = useBoardStore((state) => state.toggleTaskClosed);
  const employees = useBoardStore((state) => state.employees);
  const [draft, setDraft] = useState<TaskDraft>(() => task ? ({ title: task.title, checklist: task.checklist ?? [], priority: task.priority, status: task.status, dueDate: task.dueDate, labels: task.labels, assigneeIds: task.assigneeIds ?? [], notes: task.notes }) : ({ title: "", checklist: [], priority: "medium", status: "backlog", labels: [], assigneeIds: [], notes: "" }));
  const [comment, setComment] = useState("");
  const [labelsText, setLabelsText] = useState(task?.labels.join(", ") ?? "");
  const [newItemTitle, setNewItemTitle] = useState("");
  const autoSaveReady = useRef(false);
  const taskExists = Boolean(task);

  useEffect(() => {
    if (!taskExists || !canEdit) return;
    if (!autoSaveReady.current) {
      autoSaveReady.current = true;
      return;
    }
    if (!draft.title.trim() || draft.checklist.some((item) => !item.title.trim())) return;
    const labels = labelsText.split(",").map((item) => item.trim()).filter(Boolean);
    const activeAssigneeIds = draft.assigneeIds.filter((id) => employees[id]?.status === "active");
    updateTask(taskId, { ...draft, title: draft.title.trim(), checklist: draft.checklist.map((item) => ({ ...item, title: item.title.trim() })), labels, assigneeIds: activeAssigneeIds });
  }, [canEdit, draft, employees, labelsText, taskExists, taskId, updateTask]);

  if (!task) return null;
  const employeeList = Object.values(employees).filter((employee) => employee.status === "active").sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const deletedAssignees = draft.assigneeIds.map((id) => employees[id]).filter((employee) => employee?.status === "deleted");
  const completedItems = draft.checklist.filter((item) => item.completed).length;
  const progress = draft.checklist.length ? Math.round((completedItems / draft.checklist.length) * 100) : 0;
  const toggleAssignee = (employeeId: string) => setDraft({ ...draft, assigneeIds: draft.assigneeIds.includes(employeeId) ? draft.assigneeIds.filter((id) => id !== employeeId) : [...draft.assigneeIds, employeeId] });
  const updateChecklistItem = (id: string, updates: Partial<ChecklistItem>) => setDraft({ ...draft, checklist: draft.checklist.map((item) => item.id === id ? { ...item, ...updates } : item) });
  const addChecklistItem = () => {
    const title = newItemTitle.trim();
    if (!title) return;
    setDraft({ ...draft, checklist: [...draft.checklist, { id: uid("check"), title, completed: false, createdAt: new Date().toISOString() }] });
    setNewItemTitle("");
  };

  return (
    <Modal open onClose={onClose} title="Карточка задачи" description={!canEdit ? "Режим просмотра — изменения недоступны" : !canEditDeadlines ? "Можно редактировать задачу, кроме дедлайнов" : "Чек-лист, сроки и обсуждение в одном месте"} size="lg">
      <div className="task-modal-grid">
        <div className="task-editor">
          <label className="field"><span>Название</span><input value={draft.title} readOnly={!canEdit} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <section className="checklist-block" aria-labelledby="checklist-title">
            <div className="checklist-heading">
              <div><ListChecks size={16} /><strong id="checklist-title">Чек-лист</strong><span>{completedItems}/{draft.checklist.length}</span></div>
              {draft.checklist.length > 0 && <b>{progress}%</b>}
            </div>
            {draft.checklist.length > 0 && <div className="checklist-progress" aria-label={`Выполнено ${progress}%`}><i style={{ width: `${progress}%` }} /></div>}
            <div className="checklist-items">
              {draft.checklist.map((item) => {
                const overdue = Boolean(item.dueDate && !item.completed && isBefore(new Date(`${item.dueDate}T23:59:59`), startOfToday()));
                return <div className={cn("checklist-item", item.completed && "completed", overdue && "overdue")} key={item.id}>
                  <button type="button" className="checklist-toggle" disabled={!canEdit} onClick={() => updateChecklistItem(item.id, { completed: !item.completed })} aria-label={item.completed ? "Вернуть пункт в работу" : "Отметить пункт выполненным"} aria-pressed={item.completed}>{item.completed && <Check size={14} />}</button>
                  <div className="checklist-item-main">
                    <input value={item.title} readOnly={!canEdit} onChange={(event) => updateChecklistItem(item.id, { title: event.target.value })} aria-label="Название пункта чек-листа" />
                    <div className="checklist-item-meta">
                      <div className="checklist-date"><CalendarClock size={13} /><DatePicker value={item.dueDate} onChange={(dueDate) => updateChecklistItem(item.id, { dueDate })} disabled={!canEdit || !canEditDeadlines} disabledReason={!canEdit ? "Гостю доступен только просмотр" : "Администратор запретил изменение дедлайнов"} /></div>
                      {overdue && <span className="checklist-overdue"><AlertTriangle size={12} />Просрочено</span>}
                    </div>
                  </div>
                  {canEdit && <button type="button" className="checklist-delete" onClick={() => setDraft({ ...draft, checklist: draft.checklist.filter((current) => current.id !== item.id) })} aria-label="Удалить пункт"><Trash2 size={14} /></button>}
                </div>;
              })}
              {draft.checklist.length === 0 && <div className="checklist-empty">Добавьте первый пункт и при необходимости задайте для него дедлайн.</div>}
            </div>
            {canEdit && <div className="checklist-add"><input value={newItemTitle} onChange={(event) => setNewItemTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addChecklistItem(); } }} placeholder="Новый пункт чек-листа" aria-label="Новый пункт чек-листа" /><button type="button" className="button secondary compact" onClick={addChecklistItem} disabled={!newItemTitle.trim()}><Plus size={14} />Добавить</button></div>}
          </section>
          <div className="form-grid">
            <label className="field"><span>Приоритет</span><select value={draft.priority} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, priority: event.target.value as Priority })}>{(Object.keys(priorityMeta) as Priority[]).map((value) => <option key={value} value={value}>{priorityMeta[value].label}</option>)}</select></label>
            <label className="field"><span>Статус</span><select value={draft.status} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, status: event.target.value as TaskStatus })}>{(Object.keys(statusMeta) as TaskStatus[]).map((value) => <option key={value} value={value}>{statusMeta[value]}</option>)}</select></label>
            <div className="field"><span>Дедлайн задачи</span><DatePicker value={draft.dueDate} onChange={(dueDate) => setDraft({ ...draft, dueDate })} disabled={!canEdit || !canEditDeadlines} disabledReason={!canEdit ? "Гостю доступен только просмотр" : "Администратор запретил изменение дедлайнов"} /></div>
            <label className="field"><span>Метки через запятую</span><input value={labelsText} readOnly={!canEdit} onChange={(event) => setLabelsText(event.target.value)} placeholder="UX, Важно" /></label>
          </div>
          <div className="field assignee-field">
            <span><UserRoundCheck size={13} />Ответственные</span>
            {employeeList.length > 0 ? <div className="assignee-picker">{employeeList.map((employee) => {
              const selected = draft.assigneeIds.includes(employee.id);
              return <label className={cn(selected && "selected", !canEdit && "readonly")} key={employee.id}><input type="checkbox" checked={selected} disabled={!canEdit} onChange={() => toggleAssignee(employee.id)} /><span className="employee-avatar" style={{ background: employeeColor(employee.id) }}>{employeeInitials(employee.name)}</span><span><strong>{employee.name}</strong><small>{employee.email || employee.login}</small></span><i>{selected ? "Назначен" : canEdit ? "Назначить" : "Не назначен"}</i></label>;
            })}</div> : <div className="assignee-empty">Нет активных сотрудников для назначения.</div>}
            {deletedAssignees.length > 0 && <div className="deleted-assignee-note">Удалённые сотрудники будут сняты с задачи после сохранения: {deletedAssignees.map((employee) => employee.name).join(", ")}.</div>}
          </div>
        </div>
        <aside className="activity-panel">
          <div className="activity-heading"><MessageSquare size={16} /><span>Обсуждение</span><b>{task.comments.length}</b></div>
          <div className="comment-list">
            {task.comments.map((item) => <div className="comment" key={item.id}><div className="avatar small-avatar">{item.author.slice(0, 1)}</div><div><header><strong>{item.author}</strong><time>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ru })}</time></header><p>{item.text}</p></div></div>)}
            {task.comments.length === 0 && <div className="empty-comments">Начните обсуждение задачи</div>}
          </div>
          {canEdit && <div className="comment-form"><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Написать комментарий..." /><button className="button secondary compact" onClick={() => { if (!comment.trim()) return; addComment(task.id, comment.trim()); setComment(""); }}>Отправить</button></div>}
        </aside>
      </div>
      <footer className="modal-actions task-actions">
        {canEdit ? <div>
          <button className="button ghost" onClick={() => { updateTask(task.id, { pinned: !task.pinned }); toast.success(task.pinned ? "Задача откреплена" : "Задача закреплена"); }}><Pin size={15} />{task.pinned ? "Открепить" : "Закрепить"}</button>
          <button className={`button ghost ${task.closed ? "reopen-task" : "close-task"}`} onClick={() => { toggleTaskClosed(task.id); toast.success(task.closed ? "Задача снова открыта" : "Задача закрыта и перемещена вниз"); onClose(); }}>{task.closed ? <RotateCcw size={15} /> : <CircleCheck size={15} />}{task.closed ? "Открыть снова" : "Закрыть задачу"}</button>
          <button className="button ghost" onClick={() => { updateTask(task.id, { archived: true }); toast.success("Задача в архиве"); onClose(); }}><Archive size={15} />В архив</button>
          <button className="button ghost danger-text" onClick={() => { if (window.confirm("Удалить задачу без возможности восстановления?")) { deleteTask(task.id); toast.success("Задача удалена"); onClose(); } }}><Trash2 size={15} />Удалить</button>
        </div> : <span className="readonly-mode-note"><Eye size={14} />Только просмотр</span>}
        <div className="task-close-group">{canEdit && <span className="autosave-note">Изменения сохраняются автоматически</span>}<button className="button secondary" onClick={onClose}>Закрыть</button></div>
      </footer>
    </Modal>
  );
}
