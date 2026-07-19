"use client";

import { arrayMove } from "@dnd-kit/sortable";
import { create } from "zustand";
import { seedData } from "@/lib/seed";
import { uid } from "@/lib/utils";
import type { Board, Comment, CommentAttachment, Employee, List, Task, TaskDraft, WorkspaceData, WorkspaceSnapshot } from "@/types/board";

interface BoardState extends WorkspaceData {
  hydrated: boolean;
  version: number;
  saving: boolean;
  saveError: string | null;
  hydrateWorkspace: (snapshot: WorkspaceSnapshot) => void;
  setActiveBoard: (id: string) => void;
  setActiveBoardLocal: (id: string) => void;
  createBoard: (title: string, color?: string, description?: string) => string;
  updateBoard: (id: string, updates: Partial<Pick<Board, "title" | "description" | "color">>) => void;
  deleteBoard: (id: string) => void;
  createList: (boardId: string, title: string) => string;
  updateList: (id: string, updates: Partial<Pick<List, "title" | "collapsed" | "archived">>) => void;
  deleteList: (boardId: string, listId: string) => void;
  reorderLists: (boardId: string, activeId: string, overId: string) => void;
  upsertEmployee: (employee: Employee) => void;
  createTask: (listId: string, title: string) => string;
  updateTask: (id: string, updates: Partial<TaskDraft & Pick<Task, "closed" | "archived">>) => void;
  deleteLabel: (label: string) => void;
  toggleTaskClosed: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  moveTask: (taskId: string, fromListId: string, toListId: string, overTaskId?: string) => void;
  reorderTask: (listId: string, activeId: string, overId: string) => void;
  addComment: (taskId: string, text: string, author?: string, mentionIds?: string[], attachments?: CommentAttachment[]) => void;
  restoreTask: (taskId: string) => void;
  resetWorkspace: () => void;
}

const palette = ["#6d5dfc", "#ec4899", "#14b8a6", "#f59e0b", "#3b82f6"];
const activeBeforeClosed = (ids: string[], tasks: Record<string, Task>) => [
  ...ids.filter((id) => !tasks[id]?.closed),
  ...ids.filter((id) => tasks[id]?.closed),
];

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveInFlight = false;
let dirty = false;

function queueWorkspaceSave(get: () => BoardState, set: (partial: Partial<BoardState>) => void) {
  if (!get().hydrated) return;
  dirty = true;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flushWorkspace(get, set), 350);
}

async function flushWorkspace(get: () => BoardState, set: (partial: Partial<BoardState>) => void) {
  if (saveInFlight || !dirty) return;
  saveInFlight = true;
  dirty = false;
  const state = get();
  set({ saving: true, saveError: null });
  try {
    const response = await fetch("/api/workspace", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: state.version,
        workspace: { boards: state.boards, lists: state.lists, tasks: state.tasks, activeBoardId: state.activeBoardId },
      }),
    });
    if (response.status === 401) {
      window.location.assign("/login");
      return;
    }
    const result = await response.json() as { version?: number; error?: string };
    if (!response.ok || !result.version) throw new Error(result.error || "Не удалось сохранить изменения");
    set({ version: result.version, saving: false });
  } catch (error) {
    dirty = false;
    set({ saving: false, saveError: error instanceof Error ? error.message : "Не удалось сохранить изменения" });
  } finally {
    saveInFlight = false;
    if (dirty) {
      saveTimer = setTimeout(() => void flushWorkspace(get, set), 0);
    }
  }
}

export const useBoardStore = create<BoardState>((set, get) => {
  type StateUpdater = Partial<BoardState> | ((state: BoardState) => Partial<BoardState>);
  const mutate = (updater: StateUpdater) => {
    set(updater);
    queueWorkspaceSave(get, (partial) => set(partial));
  };

  return {
    ...seedData,
    hydrated: false,
    version: 1,
    saving: false,
    saveError: null,
    hydrateWorkspace: (snapshot) => set({ ...snapshot.workspace, version: snapshot.version, hydrated: true, saving: false, saveError: null }),
    setActiveBoard: (activeBoardId) => mutate({ activeBoardId }),
    setActiveBoardLocal: (activeBoardId) => set({ activeBoardId }),
    createBoard: (title, color, description) => {
      const id = uid("board");
      const board: Board = { id, title, description: description || "Новая рабочая доска", color: color ?? palette[Object.keys(get().boards).length % palette.length], listIds: [], createdAt: new Date().toISOString() };
      mutate((state) => ({ boards: { ...state.boards, [id]: board }, activeBoardId: id }));
      return id;
    },
    updateBoard: (id, updates) => mutate((state) => ({ boards: { ...state.boards, [id]: { ...state.boards[id], ...updates } } })),
    deleteBoard: (id) => mutate((state) => {
      const board = state.boards[id];
      if (!board) return state;
      const boards = { ...state.boards };
      const lists = { ...state.lists };
      const tasks = { ...state.tasks };
      delete boards[id];
      board.listIds.forEach((listId) => {
        lists[listId]?.taskIds.forEach((taskId) => delete tasks[taskId]);
        delete lists[listId];
      });
      return { boards, lists, tasks, activeBoardId: Object.keys(boards)[0] ?? "" };
    }),
    createList: (boardId, title) => {
      const id = uid("list");
      mutate((state) => ({
        lists: { ...state.lists, [id]: { id, title, taskIds: [], collapsed: false, archived: false } },
        boards: { ...state.boards, [boardId]: { ...state.boards[boardId], listIds: [...state.boards[boardId].listIds, id] } },
      }));
      return id;
    },
    updateList: (id, updates) => mutate((state) => ({ lists: { ...state.lists, [id]: { ...state.lists[id], ...updates } } })),
    deleteList: (boardId, listId) => mutate((state) => {
      const lists = { ...state.lists };
      const tasks = { ...state.tasks };
      lists[listId]?.taskIds.forEach((taskId) => delete tasks[taskId]);
      delete lists[listId];
      return { lists, tasks, boards: { ...state.boards, [boardId]: { ...state.boards[boardId], listIds: state.boards[boardId].listIds.filter((id) => id !== listId) } } };
    }),
    reorderLists: (boardId, activeId, overId) => mutate((state) => {
      const ids = state.boards[boardId].listIds;
      return { boards: { ...state.boards, [boardId]: { ...state.boards[boardId], listIds: arrayMove(ids, ids.indexOf(activeId), ids.indexOf(overId)) } } };
    }),
    upsertEmployee: (employee) => set((state) => ({ employees: { ...state.employees, [employee.id]: employee } })),
    createTask: (listId, title) => {
      const id = uid("task");
      const task: Task = { id, title, checklist: [], priority: "medium", status: "backlog", labels: [], assigneeIds: [], comments: [], closed: false, archived: false, createdAt: new Date().toISOString() };
      mutate((state) => ({ tasks: { ...state.tasks, [id]: task }, lists: { ...state.lists, [listId]: { ...state.lists[listId], taskIds: [...state.lists[listId].taskIds, id] } } }));
      return id;
    },
    updateTask: (id, updates) => mutate((state) => ({ tasks: { ...state.tasks, [id]: { ...state.tasks[id], ...updates } } })),
    deleteLabel: (label) => mutate((state) => ({
      tasks: Object.fromEntries(Object.entries(state.tasks).map(([id, task]) => [id, {
        ...task,
        labels: task.labels.filter((item) => item !== label),
      }])),
    })),
    toggleTaskClosed: (taskId) => mutate((state) => {
      const task = state.tasks[taskId];
      if (!task) return state;
      const closed = !task.closed;
      const tasks = { ...state.tasks, [taskId]: { ...task, closed } };
      const lists = Object.fromEntries(Object.entries(state.lists).map(([id, list]) => {
        if (!list.taskIds.includes(taskId)) return [id, list];
        const withoutTask = list.taskIds.filter((value) => value !== taskId);
        if (closed) return [id, { ...list, taskIds: [...withoutTask, taskId] }];
        const firstClosedIndex = withoutTask.findIndex((value) => tasks[value]?.closed);
        const insertAt = firstClosedIndex === -1 ? withoutTask.length : firstClosedIndex;
        return [id, { ...list, taskIds: [...withoutTask.slice(0, insertAt), taskId, ...withoutTask.slice(insertAt)] }];
      }));
      return { tasks, lists };
    }),
    deleteTask: (taskId) => mutate((state) => {
      const tasks = { ...state.tasks };
      delete tasks[taskId];
      return { tasks, lists: Object.fromEntries(Object.entries(state.lists).map(([id, list]) => [id, { ...list, taskIds: list.taskIds.filter((value) => value !== taskId) }])) };
    }),
    moveTask: (taskId, fromListId, toListId, overTaskId) => mutate((state) => {
      const sourceIds = state.lists[fromListId].taskIds.filter((id) => id !== taskId);
      const targetBase = fromListId === toListId ? sourceIds : state.lists[toListId].taskIds.filter((id) => id !== taskId);
      const index = overTaskId ? Math.max(0, targetBase.indexOf(overTaskId)) : targetBase.length;
      const targetIds = activeBeforeClosed([...targetBase.slice(0, index), taskId, ...targetBase.slice(index)], state.tasks);
      return { lists: { ...state.lists, [fromListId]: { ...state.lists[fromListId], taskIds: fromListId === toListId ? targetIds : activeBeforeClosed(sourceIds, state.tasks) }, [toListId]: { ...state.lists[toListId], taskIds: targetIds } } };
    }),
    reorderTask: (listId, activeId, overId) => mutate((state) => {
      const ids = state.lists[listId].taskIds;
      return { lists: { ...state.lists, [listId]: { ...state.lists[listId], taskIds: activeBeforeClosed(arrayMove(ids, ids.indexOf(activeId), ids.indexOf(overId)), state.tasks) } } };
    }),
    addComment: (taskId, text, author = "Вы", mentionIds = [], attachments = []) => {
      const comment: Comment = { id: uid("comment"), author, text, createdAt: new Date().toISOString(), mentionIds: [...new Set(mentionIds)], attachments };
      mutate((state) => ({ tasks: { ...state.tasks, [taskId]: { ...state.tasks[taskId], comments: [...state.tasks[taskId].comments, comment] } } }));
    },
    restoreTask: (taskId) => mutate((state) => ({ tasks: { ...state.tasks, [taskId]: { ...state.tasks[taskId], archived: false } } })),
    resetWorkspace: () => mutate((state) => ({ ...seedData, employees: state.employees })),
  };
});
