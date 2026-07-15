"use client";

import { useState } from "react";
import { Archive, CalendarDays, MessageSquare, Pin, Save, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { priorityMeta, statusMeta } from "@/lib/utils";
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
  const [draft, setDraft] = useState<TaskDraft>(() => task ? ({ title: task.title, description: task.description, priority: task.priority, status: task.status, dueDate: task.dueDate, labels: task.labels, notes: task.notes }) : ({ title: "", description: "", priority: "medium", status: "backlog", labels: [], notes: "" }));
  const [comment, setComment] = useState("");
  const [labelsText, setLabelsText] = useState(task?.labels.join(", ") ?? "");

  if (!task) return null;

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
            <label className="field"><span>Дедлайн</span><div className="input-icon"><CalendarDays size={16} /><input type="date" value={draft.dueDate ?? ""} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value || undefined })} /></div></label>
            <label className="field"><span>Метки через запятую</span><input value={labelsText} onChange={(event) => setLabelsText(event.target.value)} placeholder="UX, Важно" /></label>
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
          <button className="button ghost" onClick={() => { updateTask(task.id, { archived: true }); toast.success("Задача в архиве"); onClose(); }}><Archive size={15} />В архив</button>
          <button className="button ghost danger-text" onClick={() => { if (window.confirm("Удалить задачу без возможности восстановления?")) { deleteTask(task.id); toast.success("Задача удалена"); onClose(); } }}><Trash2 size={15} />Удалить</button>
        </div>
        <div><button className="button secondary" onClick={onClose}>Отмена</button><button className="button primary" onClick={save}><Save size={15} />Сохранить</button></div>
      </footer>
    </Modal>
  );
}
