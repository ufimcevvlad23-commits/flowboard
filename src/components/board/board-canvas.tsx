"use client";

import { useState } from "react";
import { closestCorners, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus, SearchX } from "lucide-react";
import { toast } from "sonner";
import { sortTasks, taskMatches, type TaskSort } from "@/lib/task-filter";
import { useBoardStore } from "@/store/use-board-store";
import type { Filters, Task } from "@/types/board";
import { ListColumn } from "./list-column";
import { TaskCard } from "./task-card";

interface BoardCanvasProps {
  boardId: string;
  search: string;
  filters: Filters;
  onOpenTask: (id: string) => void;
  sort: TaskSort;
  canEdit: boolean;
}

export function BoardCanvas({ boardId, search, filters, onOpenTask, sort, canEdit }: BoardCanvasProps) {
  const board = useBoardStore((state) => state.boards[boardId]);
  const lists = useBoardStore((state) => state.lists);
  const tasks = useBoardStore((state) => state.tasks);
  const createList = useBoardStore((state) => state.createList);
  const reorderLists = useBoardStore((state) => state.reorderLists);
  const reorderTask = useBoardStore((state) => state.reorderTask);
  const moveTask = useBoardStore((state) => state.moveTask);
  const [addingList, setAddingList] = useState(false);
  const [listTitle, setListTitle] = useState("");
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  if (!board) return null;
  const visibleLists = board.listIds.map((id) => lists[id]).filter((list) => list && !list.archived);
  const normalizedSearch = search.trim().toLocaleLowerCase("ru");

  const handleDragStart = ({ active }: DragStartEvent) => {
    if (!canEdit) return;
    if (active.data.current?.type === "task") setActiveTask(tasks[String(active.id)]);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTask(null);
    if (!canEdit) return;
    if (!over || active.id === over.id) return;
    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;
    if (activeType === "list" && overType === "list") reorderLists(boardId, String(active.id), String(over.id));
    if (activeType === "task") {
      const fromListId = String(active.data.current?.listId);
      const toListId = overType === "task" ? String(over.data.current?.listId) : String(over.id);
      if (!lists[toListId]) return;
      if (fromListId === toListId && overType === "task") reorderTask(fromListId, String(active.id), String(over.id));
      else moveTask(String(active.id), fromListId, toListId, overType === "task" ? String(over.id) : undefined);
    }
  };

  const submitList = () => {
    if (!listTitle.trim()) return;
    createList(boardId, listTitle.trim()); setListTitle(""); setAddingList(false); toast.success("Список создан");
  };

  const totalVisible = visibleLists.reduce((count, list) => count + list.taskIds.map((id) => tasks[id]).filter((task) => task && taskMatches(task, search, filters, list.title)).length, 0);
  const matchingEmptyList = Boolean(normalizedSearch) && visibleLists.some((list) => list.title.toLocaleLowerCase("ru").includes(normalizedSearch) && list.taskIds.length === 0);
  const hasActiveFilter = Boolean(search || filters.priorities.length || filters.statuses.length || filters.label || filters.due !== "all");

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveTask(null)}>
      <div className="board-scroll">
        {totalVisible === 0 && !matchingEmptyList && hasActiveFilter && <div className="no-results"><SearchX size={24} /><div><strong>Ничего не найдено</strong><span>Измените запрос или сбросьте фильтры</span></div></div>}
        <SortableContext items={visibleLists.map((list) => list.id)} strategy={horizontalListSortingStrategy}>
          <div className="board-columns">
            {visibleLists.map((list) => <ListColumn key={list.id} listId={list.id} boardId={boardId} tasks={sortTasks(list.taskIds.map((id) => tasks[id]).filter((task): task is Task => Boolean(task) && taskMatches(task, search, filters, list.title)), sort)} onOpenTask={onOpenTask} canEdit={canEdit} />)}
            {canEdit && (addingList ? <div className="new-list-form"><input autoFocus value={listTitle} onChange={(event) => setListTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submitList()} placeholder="Название списка" /><div><button className="button primary compact" onClick={submitList}>Создать</button><button className="button ghost compact" onClick={() => setAddingList(false)}>Отмена</button></div></div> : <button className="add-list-button" onClick={() => setAddingList(true)}><Plus size={18} />Добавить список</button>)}
          </div>
        </SortableContext>
      </div>
      <DragOverlay>{activeTask ? <TaskCard task={activeTask} listId="overlay" onOpen={() => undefined} overlay canEdit={canEdit} /> : null}</DragOverlay>
    </DndContext>
  );
}
