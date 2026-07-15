"use client";
/* eslint-disable react-hooks/refs -- dnd-kit exposes callback refs/listeners for render by design */

import { useState } from "react";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, GripVertical, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/store/use-board-store";
import type { Task } from "@/types/board";
import { TaskCard } from "./task-card";

interface ListColumnProps {
  listId: string;
  boardId: string;
  tasks: Task[];
  onOpenTask: (id: string) => void;
}

export function ListColumn({ listId, boardId, tasks, onOpenTask }: ListColumnProps) {
  const list = useBoardStore((state) => state.lists[listId]);
  const createTask = useBoardStore((state) => state.createTask);
  const updateList = useBoardStore((state) => state.updateList);
  const deleteList = useBoardStore((state) => state.deleteList);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const sortable = useSortable({ id: listId, data: { type: "list" } });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };

  if (!list) return null;

  const submitTask = () => {
    if (!title.trim()) return;
    const id = createTask(listId, title.trim());
    setTitle(""); setAdding(false); onOpenTask(id);
    toast.success("Задача создана");
  };

  return (
    <section ref={sortable.setNodeRef} style={style} className={cn("list-column", sortable.isDragging && "list-dragging")}>
      <header className="list-header">
        <button className="drag-handle" {...sortable.attributes} {...sortable.listeners} aria-label={`Перетащить список ${list.title}`}><GripVertical size={16} /></button>
        <input value={list.title} onChange={(event) => updateList(listId, { title: event.target.value })} aria-label="Название списка" />
        <span className="list-count">{tasks.length}</span>
        <div className="list-menu-wrap">
          <button className="icon-button small" onClick={() => setMenuOpen(!menuOpen)} aria-label="Действия со списком"><MoreHorizontal size={17} /></button>
          {menuOpen && <div className="mini-menu">
            <button onClick={() => { updateList(listId, { archived: true }); setMenuOpen(false); toast.success("Список перемещён в архив"); }}><Archive size={14} />Архивировать</button>
            <button className="danger-item" onClick={() => { if (window.confirm(`Удалить список «${list.title}» и все его задачи?`)) { deleteList(boardId, listId); toast.success("Список удалён"); } }}><Trash2 size={14} />Удалить</button>
          </div>}
        </div>
      </header>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="task-stack">
          {tasks.map((task) => <TaskCard key={task.id} task={task} listId={listId} onOpen={onOpenTask} />)}
          {tasks.length === 0 && !adding && <button className="empty-list" onClick={() => setAdding(true)}><span>Здесь пока пусто</span><small>Добавьте первую задачу</small></button>}
        </div>
      </SortableContext>
      {adding ? (
        <div className="quick-add-form">
          <textarea autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitTask(); } }} placeholder="Название задачи..." />
          <div><button className="button primary compact" onClick={submitTask}>Добавить</button><button className="icon-button" onClick={() => { setAdding(false); setTitle(""); }} aria-label="Отмена"><X size={17} /></button></div>
        </div>
      ) : <button className="add-task-button" onClick={() => setAdding(true)}><Plus size={17} />Добавить задачу</button>}
    </section>
  );
}
