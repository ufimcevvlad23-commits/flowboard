"use client";
/* eslint-disable @next/next/no-img-element -- comment screenshots are user-provided data URLs */

import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent as ReactClipboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Archive, Check, CircleCheck, Eye, Flag, MessageSquare, Paperclip, Plus, RotateCcw, Tag, Trash2, UserRoundPlus, X } from "lucide-react";
import { formatDistanceToNow, isBefore, startOfToday } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { DatePicker } from "@/components/ui/date-picker";
import { SelectMenu } from "@/components/ui/select-menu";
import { cn, employeeColor, employeeInitials, priorityMeta, uid } from "@/lib/utils";
import { useBoardStore } from "@/store/use-board-store";
import type { ChecklistItem, CommentAttachment, Employee, Priority, SessionUser, TaskDraft } from "@/types/board";

interface TaskModalProps {
  taskId: string;
  onClose: () => void;
  canEdit: boolean;
  canEditDeadlines: boolean;
  currentUser: SessionUser;
}

function renderMentions(text: string, employees: Employee[]): ReactNode[] {
  const hits: Array<{ start: number; end: number }> = [];
  employees.forEach((employee) => {
    const token = `@${employee.name}`;
    let start = text.toLocaleLowerCase("ru").indexOf(token.toLocaleLowerCase("ru"));
    while (start !== -1) {
      hits.push({ start, end: start + token.length });
      start = text.toLocaleLowerCase("ru").indexOf(token.toLocaleLowerCase("ru"), start + token.length);
    }
  });
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const result: ReactNode[] = [];
  let cursor = 0;
  hits.forEach((hit) => {
    if (hit.start < cursor) return;
    if (hit.start > cursor) result.push(text.slice(cursor, hit.start));
    result.push(<mark className="comment-mention" key={`${hit.start}-${hit.end}`}>{text.slice(hit.start, hit.end)}</mark>);
    cursor = hit.end;
  });
  if (cursor < text.length) result.push(text.slice(cursor));
  return result.length ? result : [text];
}

function readImage(file: File): Promise<CommentAttachment> {
  return new Promise((resolve, reject) => {
    if (!(["image/png", "image/jpeg", "image/webp"] as string[]).includes(file.type)) return reject(new Error("Можно прикреплять PNG, JPG или WebP"));
    if (file.size > 2_000_000) return reject(new Error(`Файл «${file.name}» больше 2 МБ`));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Не удалось прочитать «${file.name}»`));
    reader.onload = () => resolve({ id: uid("image"), name: file.name.slice(0, 180), type: file.type as CommentAttachment["type"], dataUrl: String(reader.result), size: file.size });
    reader.readAsDataURL(file);
  });
}

export function TaskModal({ taskId, onClose, canEdit, canEditDeadlines, currentUser }: TaskModalProps) {
  const task = useBoardStore((state) => taskId ? state.tasks[taskId] : undefined);
  const tasks = useBoardStore((state) => state.tasks);
  const updateTask = useBoardStore((state) => state.updateTask);
  const deleteTask = useBoardStore((state) => state.deleteTask);
  const addComment = useBoardStore((state) => state.addComment);
  const toggleTaskClosed = useBoardStore((state) => state.toggleTaskClosed);
  const employees = useBoardStore((state) => state.employees);
  const [draft, setDraft] = useState<TaskDraft>(() => task ? ({ title: task.title, checklist: task.checklist ?? [], priority: task.priority, status: task.status, dueDate: task.dueDate, labels: task.labels, assigneeIds: task.assigneeIds ?? [] }) : ({ title: "", checklist: [], priority: "medium", status: "backlog", labels: [], assigneeIds: [] }));
  const [comment, setComment] = useState("");
  const [attachments, setAttachments] = useState<CommentAttachment[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<CommentAttachment | null>(null);
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [tagOpen, setTagOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const autoSaveReady = useRef(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const taskExists = Boolean(task);

  useEffect(() => {
    if (!taskExists || !task || !canEdit) return;
    if (!autoSaveReady.current) { autoSaveReady.current = true; return; }
    if (!draft.title.trim() || draft.checklist.some((item) => !item.title.trim())) return;
    const normalizedDraft = { ...draft, title: draft.title.trim(), checklist: draft.checklist.map((item) => ({ ...item, title: item.title.trim() })) };
    const unchanged = normalizedDraft.title === task.title
      && normalizedDraft.priority === task.priority
      && normalizedDraft.status === task.status
      && normalizedDraft.dueDate === task.dueDate
      && JSON.stringify(normalizedDraft.labels) === JSON.stringify(task.labels)
      && JSON.stringify(normalizedDraft.assigneeIds) === JSON.stringify(task.assigneeIds)
      && JSON.stringify(normalizedDraft.checklist) === JSON.stringify(task.checklist);
    if (!unchanged) updateTask(taskId, normalizedDraft);
  }, [canEdit, draft, task, taskExists, taskId, updateTask]);

  if (!task) return null;
  const employeeList = Object.values(employees).filter((employee) => employee.status === "active").sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const normalizedMentionQuery = mentionQuery?.toLocaleLowerCase("ru") ?? "";
  const mentionEmployees = employeeList
    .filter((employee) => mentionQuery !== null && employee.name.toLocaleLowerCase("ru").includes(normalizedMentionQuery))
    .sort((a, b) => {
      const startsWithQuery = (name: string) => name.toLocaleLowerCase("ru").split(/\s+/).some((part) => part.startsWith(normalizedMentionQuery));
      return Number(startsWithQuery(b.name)) - Number(startsWithQuery(a.name)) || a.name.localeCompare(b.name, "ru");
    })
    .slice(0, 6);
  const deletedAssignees = draft.assigneeIds.map((id) => employees[id]).filter((employee) => employee?.status === "deleted");
  const assignedEmployees = draft.assigneeIds.map((id) => employees[id]).filter((employee) => employee?.status === "active");
  const allLabels = [...new Set(Object.values(tasks).flatMap((item) => item.labels))].sort((a, b) => a.localeCompare(b, "ru"));
  const toggleAssignee = (employeeId: string) => setDraft((current) => ({ ...current, assigneeIds: current.assigneeIds.includes(employeeId) ? current.assigneeIds.filter((id) => id !== employeeId) : [...current.assigneeIds, employeeId] }));
  const updateChecklistItem = (id: string, updates: Partial<ChecklistItem>) => setDraft((current) => ({ ...current, checklist: current.checklist.map((item) => item.id === id ? { ...item, ...updates } : item) }));
  const addChecklistItem = () => {
    const title = newItemTitle.trim();
    if (!title) return;
    setDraft((current) => ({ ...current, checklist: [...current.checklist, { id: uid("check"), title, completed: false, createdAt: new Date().toISOString() }] }));
    setNewItemTitle("");
  };
  const toggleLabel = (label: string) => setDraft((current) => ({ ...current, labels: current.labels.includes(label) ? current.labels.filter((item) => item !== label) : [...current.labels, label] }));
  const createLabel = () => {
    const label = newTag.trim().slice(0, 80);
    if (!label) return;
    setDraft((current) => ({ ...current, labels: current.labels.includes(label) ? current.labels : [...current.labels, label] }));
    setNewTag("");
    setTagOpen(false);
  };
  const updateComment = (value: string, caret: number) => {
    setComment(value);
    const beforeCaret = value.slice(0, caret);
    const match = beforeCaret.match(/(?:^|\s)@([\p{L}\d._-]*)$/u);
    if (!match) { setMentionQuery(null); setMentionStart(null); return; }
    setMentionQuery(match[1]);
    setMentionStart(beforeCaret.lastIndexOf("@"));
  };
  const insertMention = (employee: Employee) => {
    if (mentionStart === null) return;
    const caret = commentRef.current?.selectionStart ?? comment.length;
    const next = `${comment.slice(0, mentionStart)}@${employee.name} ${comment.slice(caret)}`;
    setComment(next);
    setMentionIds((current) => current.includes(employee.id) ? current : [...current, employee.id]);
    setMentionQuery(null);
    setMentionStart(null);
    requestAnimationFrame(() => { commentRef.current?.focus(); commentRef.current?.setSelectionRange(mentionStart + employee.name.length + 2, mentionStart + employee.name.length + 2); });
  };
  const appendImages = async (incomingFiles: File[]) => {
    const availableSlots = Math.max(0, 4 - attachments.length);
    if (availableSlots === 0) { toast.error("Можно прикрепить не более четырёх изображений"); return; }
    const files = incomingFiles.filter((file) => file.type.startsWith("image/")).slice(0, availableSlots);
    if (files.length === 0) return;
    try {
      const nextAttachments = await Promise.all(files.map(readImage));
      setAttachments((current) => [...current, ...nextAttachments]);
    }
    catch (error) { toast.error(error instanceof Error ? error.message : "Не удалось добавить изображение"); }
  };
  const addImages = async (event: ChangeEvent<HTMLInputElement>) => {
    await appendImages([...(event.target.files ?? [])]);
    event.target.value = "";
  };
  const pasteImages = (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...event.clipboardData.items].map((item) => item.kind === "file" ? item.getAsFile() : null).filter((file): file is File => Boolean(file?.type.startsWith("image/")));
    if (files.length === 0) return;
    event.preventDefault();
    void appendImages(files);
  };
  const sendComment = () => {
    const text = comment.trim();
    if (!text && attachments.length === 0) return;
    const detectedMentions = employeeList.filter((employee) => text.toLocaleLowerCase("ru").includes(`@${employee.name}`.toLocaleLowerCase("ru"))).map((employee) => employee.id);
    addComment(task.id, text, currentUser.name, [...new Set([...mentionIds, ...detectedMentions])], attachments);
    setComment(""); setAttachments([]); setMentionIds([]); setMentionQuery(null);
  };

  return (
    <Modal open onClose={() => previewAttachment ? setPreviewAttachment(null) : onClose()} title="" size="lg">
      <div className="task-modal-grid">
        <div className="task-editor">
          <label className="field task-title-field"><span>Название</span><textarea rows={2} value={draft.title} readOnly={!canEdit} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label>
          <div className="task-property-bar" aria-label="Свойства задачи">
            <SelectMenu compact iconOnly icon={<Flag size={16} style={{ color: priorityMeta[draft.priority].color }} />} title={`Приоритет: ${priorityMeta[draft.priority].label}`} value={draft.priority} disabled={!canEdit} ariaLabel="Приоритет" options={(Object.keys(priorityMeta) as Priority[]).map((value) => ({ value, label: priorityMeta[value].label }))} onChange={(value) => setDraft((current) => ({ ...current, priority: value as Priority }))} />
            <DatePicker compact iconOnly value={draft.dueDate} onChange={(dueDate) => setDraft((current) => ({ ...current, dueDate }))} disabled={!canEdit || !canEditDeadlines} disabledReason={!canEdit ? "Гостю доступен только просмотр" : "Нет права изменять дедлайны"} />
            <div className="task-tag-control"><button type="button" className={cn("task-property-button", draft.labels.length > 0 && "active")} onClick={() => setTagOpen((open) => !open)} disabled={!canEdit} aria-label="Теги задачи" aria-expanded={tagOpen}><Tag size={16} />{draft.labels.length > 0 && <b>{draft.labels.length}</b>}</button>{tagOpen && <div className="task-tag-popover"><strong>Теги</strong>{allLabels.map((label) => <button type="button" className={draft.labels.includes(label) ? "selected" : ""} key={label} onClick={() => toggleLabel(label)}><span>{label}</span>{draft.labels.includes(label) && <Check size={13} />}</button>)}{allLabels.length === 0 && <small>Тегов пока нет — создайте первый.</small>}<div><input value={newTag} onChange={(event) => setNewTag(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); createLabel(); } }} placeholder="Новый тег" /><button type="button" onClick={createLabel} disabled={!newTag.trim()}><Plus size={13} /></button></div></div>}</div>
            <div className="task-assignee-control"><button type="button" className={cn("task-property-button", assignedEmployees.length > 0 && "active")} onClick={() => setAssigneeOpen((open) => !open)} disabled={!canEdit} aria-label="Ответственные" aria-expanded={assigneeOpen}><UserRoundPlus size={16} />{assignedEmployees.length > 0 && <b>{assignedEmployees.length}</b>}</button>{assigneeOpen && <div className="task-assignee-popover"><strong>Ответственные</strong>{employeeList.map((employee) => { const selected = draft.assigneeIds.includes(employee.id); return <button type="button" className={selected ? "selected" : ""} key={employee.id} onClick={() => toggleAssignee(employee.id)}><span className="employee-avatar" style={{ background: employeeColor(employee.id) }}>{employeeInitials(employee.name)}</span><span>{employee.name}</span>{selected && <Check size={13} />}</button>; })}{employeeList.length === 0 && <small>Нет активных сотрудников</small>}{deletedAssignees.length > 0 && <small>Удалённые сотрудники сохранены в истории назначения и не имеют доступа.</small>}</div>}</div>
            {assignedEmployees.map((employee) => <span className="employee-avatar task-property-avatar" style={{ background: employeeColor(employee.id) }} title={employee.name} key={employee.id}>{employeeInitials(employee.name)}</span>)}
            {draft.labels.map((label) => <span className="task-property-tag" key={label}>{label}</span>)}
          </div>
          <section className="checklist-block" aria-labelledby="checklist-title">
            <div className="checklist-heading"><div><strong id="checklist-title">Подзадачи</strong></div></div>
            <div className="checklist-items">
              {draft.checklist.map((item) => {
                const overdue = Boolean(item.dueDate && !item.completed && isBefore(new Date(`${item.dueDate}T23:59:59`), startOfToday()));
                return <div className={cn("checklist-item", item.completed && "completed", overdue && "overdue")} key={item.id}>
                  <button type="button" className="checklist-toggle" disabled={!canEdit} onClick={() => updateChecklistItem(item.id, { completed: !item.completed })} aria-label={item.completed ? "Вернуть пункт в работу" : "Отметить пункт выполненным"} aria-pressed={item.completed}>{item.completed && <Check size={14} />}</button>
                  <input className="checklist-title-input" value={item.title} readOnly={!canEdit} onChange={(event) => updateChecklistItem(item.id, { title: event.target.value })} aria-label="Название пункта чек-листа" />
                  <div className="checklist-date"><DatePicker compact value={item.dueDate} onChange={(dueDate) => updateChecklistItem(item.id, { dueDate })} disabled={!canEdit || !canEditDeadlines} disabledReason={!canEdit ? "Гостю доступен только просмотр" : "Нет права изменять дедлайны"} /></div>
                  {overdue && <span className="checklist-overdue" title="Дедлайн подзадачи просрочен"><AlertTriangle size={13} /></span>}
                  {canEdit && <button type="button" className="checklist-delete" onClick={() => setDraft((current) => ({ ...current, checklist: current.checklist.filter((currentItem) => currentItem.id !== item.id) }))} aria-label="Удалить пункт"><Trash2 size={14} /></button>}
                </div>;
              })}
              {draft.checklist.length === 0 && <div className="checklist-empty">Добавьте первую подзадачу</div>}
            </div>
            {canEdit && <div className="checklist-add"><input value={newItemTitle} onChange={(event) => setNewItemTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addChecklistItem(); } }} placeholder="Новая подзадача" aria-label="Новая подзадача" /><button type="button" className="button secondary compact" onClick={addChecklistItem} disabled={!newItemTitle.trim()}><Plus size={14} />Добавить</button></div>}
          </section>
        </div>
        <aside className="activity-panel">
          <div className="activity-heading"><MessageSquare size={16} /><span>Обсуждение</span><b>{task.comments.length}</b></div>
          <div className="comment-list">{task.comments.map((item) => <div className="comment" key={item.id}><div className="avatar small-avatar">{item.author.slice(0, 1)}</div><div><header><strong>{item.author}</strong><time>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ru })}</time></header>{item.text && <p>{renderMentions(item.text, employeeList)}</p>}{(item.attachments ?? []).length > 0 && <div className="comment-images">{item.attachments.map((attachment) => <button type="button" onClick={() => setPreviewAttachment(attachment)} key={attachment.id} title={`Открыть ${attachment.name}`} aria-label={`Открыть изображение ${attachment.name}`}><img src={attachment.dataUrl} alt={attachment.name} /></button>)}</div>}</div></div>)}{task.comments.length === 0 && <div className="empty-comments">Начните обсуждение задачи</div>}</div>
          {canEdit && <div className="comment-form"><textarea ref={commentRef} value={comment} onChange={(event) => updateComment(event.target.value, event.target.selectionStart)} onPaste={pasteImages} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (mentionQuery !== null && mentionEmployees[0]) insertMention(mentionEmployees[0]); else sendComment(); } }} placeholder="Комментарий… @ — упомянуть, Ctrl+V — вставить скриншот" />{mentionQuery !== null && <div className="mention-popover"><div className="mention-title">Упомянуть сотрудника</div>{mentionEmployees.map((employee) => <button type="button" key={employee.id} onClick={() => insertMention(employee)}><span className="employee-avatar" style={{ background: employeeColor(employee.id) }}>{employeeInitials(employee.name)}</span><span><strong>{employee.name}</strong><small>{employee.email || employee.login}</small></span></button>)}{mentionEmployees.length === 0 && <span className="mention-empty">Сотрудники не найдены</span>}</div>}{attachments.length > 0 && <div className="pending-images">{attachments.map((attachment) => <div key={attachment.id}><img src={attachment.dataUrl} alt={attachment.name} /><button type="button" onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))} aria-label={`Убрать ${attachment.name}`}><X size={12} /></button></div>)}</div>}<div className="comment-actions"><input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(event) => void addImages(event)} /><button type="button" className="icon-button" onClick={() => fileInputRef.current?.click()} disabled={attachments.length >= 4} aria-label="Добавить скриншот" title="Добавить скриншот"><Paperclip size={16} /></button><button className="button secondary compact" onClick={sendComment} disabled={!comment.trim() && attachments.length === 0}>Отправить</button></div></div>}
        </aside>
      </div>
      <footer className="modal-actions task-actions">{canEdit ? <div><button className={`button ghost ${task.closed ? "reopen-task" : "close-task"}`} onClick={() => { toggleTaskClosed(task.id); toast.success(task.closed ? "Задача снова открыта" : "Задача закрыта и перемещена вниз"); onClose(); }}>{task.closed ? <RotateCcw size={15} /> : <CircleCheck size={15} />}{task.closed ? "Открыть снова" : "Закрыть задачу"}</button><button className="button ghost" onClick={() => { updateTask(task.id, { archived: true }); toast.success("Задача в архиве"); onClose(); }}><Archive size={15} />В архив</button><button className="button ghost danger-text" onClick={() => { if (window.confirm("Удалить задачу без возможности восстановления?")) { deleteTask(task.id); toast.success("Задача удалена"); onClose(); } }}><Trash2 size={15} />Удалить</button></div> : <span className="readonly-mode-note"><Eye size={14} />Только просмотр</span>}<div className="task-close-group">{canEdit && <span className="autosave-note">Изменения сохраняются автоматически</span>}<button className="button secondary" onClick={onClose}>Закрыть</button></div></footer>
      {previewAttachment && createPortal(<div className="image-lightbox" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPreviewAttachment(null)}><div role="dialog" aria-modal="true" aria-label={`Просмотр изображения ${previewAttachment.name}`}><header><span>{previewAttachment.name}</span><button type="button" className="icon-button" onClick={() => setPreviewAttachment(null)} aria-label="Закрыть изображение"><X size={20} /></button></header><img src={previewAttachment.dataUrl} alt={previewAttachment.name} /></div></div>, document.body)}
    </Modal>
  );
}
