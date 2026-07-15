"use client";

import { useState } from "react";
import { Archive, CircleCheck, MessageSquare, Pin, RotateCcw, Save, Trash2, UserRoundCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { DatePicker } from "@/components/ui/date-picker";
import { employeeColor, employeeInitials, priorityMeta, statusMeta } from "@/lib/utils";
import { useBoardStore } from "@/store/use-board-store";
import type { Priority, TaskDraft, TaskStatus } from "@/types/board";

interface TaskModalProps {
  taskId: string;
  onClose: () => void;
}

export function TaskModal({ taskId, onClose }: TaskModalProps) {
  const task = useBoardStore((state) => taskId ? state.tasks[taskId] : undefined);
  const updateTask = useBoardStore((state) => state.updateTask);
  const deleteTask = useBoardStore((state) => state.deleteTask);
  const addComment = useBoardStore((state) => state.addComment);
  const toggleTaskClosed = useBoardStore((state) => state.toggleTaskClosed);
  const employees = useBoardStore((state) => state.employees);
  const [draft, setDraft] = useState<TaskDraft>(() => task ? ({ title: task.title, description: task.description, priority: task.priority, status: task.status, dueDate: task.dueDate, labels: task.labels, assigneeIds: task.assigneeIds ?? [], notes: task.notes }) : ({ title: "", description: "", priority: "medium", status: "backlog", labels: [], assigneeIds: [], notes: "" }));
  const [comment, setComment] = useState("");
  const [labelsText, setLabelsText] = useState(task?.labels.join(", ") ?? "");

  if (!task) return null;
  const employeeList = Object.values(employees).sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const toggleAssignee = (employeeId: string) => setDraft({ ...draft, assigneeIds: draft.assigneeIds.includes(employeeId) ? draft.assigneeIds.filter((id) => id !== employeeId) : [...draft.assigneeIds, employeeId] });

  const save = () => {
    if (!draft.title.trim()) { toast.error("Введите название задачи"); return; }
    const labels = labelsText.split(",").map((item) => item.trim()).filter(Boolean);
    updateTask(task.id, { ...draft, title: draft.title.trim(), labels });
    toast.success("Изменения сохранены"); onClose();
  };

  return (
    <Modal open onClose={onClose} title="Карточка задачи" description="Все детали и обсуждение в одном месте" size="lg">
      <div className="task-modal-grid">
        <div className="task-editor">
          <label className="field"><span>Название</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label className="field"><span>Описание</span><textarea rows={5} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Добавьте контекст и критерии готовности..." /></label>
          <div className="form-grid">
            <label className="field"><span>Приоритет</span><select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as Priority })}>{(Object.keys(priorityMeta) as Priority[]).map((value) => <option key={value} value={value}>{priorityMeta[value].label}</option>)}</select></label>
            <label className="field"><span>Статус</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as TaskStatus })}>{(Object.keys(statusMeta) as TaskStatus[]).map((value) => <option key={value} value={value}>{statusMeta[value]}</option>)}</select></label>
            <div className="field"><span>Дедлайн</span><DatePicker value={draft.dueDate} onChange={(dueDate) => setDraft({ ...draft, dueDate })} /></div>
            <label className="field"><span>Метки через запятую</span><input value={labelsText} onChange={(event) => setLabelsText(event.target.value)} placeholder="UX, Важно" /></label>
          </div>
          <div className="field assignee-field">
            <span><UserRoundCheck size={13} />Ответственные</span>
            {employeeList.length > 0 ? <div className="assignee-picker">{employeeList.map((employee) => {
              const selected = draft.assigneeIds.includes(employee.id);
              return <label className={selected ? "selected" : ""} key={employee.id}><input type="checkbox" checked={selected} onChange={() => toggleAssignee(employee.id)} /><span className="employee-avatar" style={{ background: employeeColor(employee.id) }}>{employeeInitials(employee.name)}</span><span><strong>{employee.name}</strong>{employee.email && <small>{employee.email}</small>}</span><i>{selected ? "Назначен" : "Назначить"}</i></label>;
            })}</div> : <div className="assignee-empty">Сначала добавьте сотрудников через кнопку «Сотрудники» на доске.</div>}
          </div>
          <label className="field"><span>Вложения и заметки</span><textarea rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Ссылки, файлы или рабочие заметки..." /></label>
        </div>
        <aside className="activity-panel">
          <div className="activity-heading"><MessageSquare size={16} /><span>Обсуждение</span><b>{task.comments.length}</b></div>
          <div className="comment-list">
            {task.comments.map((item) => <div className="comment" key={item.id}><div className="avatar small-avatar">{item.author.slice(0, 1)}</div><div><header><strong>{item.author}</strong><time>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ru })}</time></header><p>{item.text}</p></div></div>)}
            {task.comments.length === 0 && <div className="empty-comments">Начните обсуждение задачи</div>}
          </div>
          <div className="comment-form"><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Написать комментарий..." /><button className="button secondary compact" onClick={() => { if (!comment.trim()) return; addComment(task.id, comment.trim()); setComment(""); }}>Отправить</button></div>
        </aside>
      </div>
      <footer className="modal-actions task-actions">
        <div>
          <button className="button ghost" onClick={() => { updateTask(task.id, { pinned: !task.pinned }); toast.success(task.pinned ? "Задача откреплена" : "Задача закреплена"); }}><Pin size={15} />{task.pinned ? "Открепить" : "Закрепить"}</button>
          <button className={`button ghost ${task.closed ? "reopen-task" : "close-task"}`} onClick={() => { toggleTaskClosed(task.id); toast.success(task.closed ? "Задача снова открыта" : "Задача закрыта и перемещена вниз"); onClose(); }}>{task.closed ? <RotateCcw size={15} /> : <CircleCheck size={15} />}{task.closed ? "Открыть снова" : "Закрыть задачу"}</button>
          <button className="button ghost" onClick={() => { updateTask(task.id, { archived: true }); toast.success("Задача в архиве"); onClose(); }}><Archive size={15} />В архив</button>
          <button className="button ghost danger-text" onClick={() => { if (window.confirm("Удалить задачу без возможности восстановления?")) { deleteTask(task.id); toast.success("Задача удалена"); onClose(); } }}><Trash2 size={15} />Удалить</button>
        </div>
        <div><button className="button secondary" onClick={onClose}>Отмена</button><button className="button primary" onClick={save}><Save size={15} />Сохранить</button></div>
      </footer>
    </Modal>
  );
}
