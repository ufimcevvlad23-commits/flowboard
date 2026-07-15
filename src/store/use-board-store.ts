"use client";

import { arrayMove } from "@dnd-kit/sortable";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { seedData } from "@/lib/seed";
import { uid } from "@/lib/utils";
import type { Board, Comment, Employee, List, Task, TaskDraft, WorkspaceData } from "@/types/board";

interface BoardState extends WorkspaceData {
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  setActiveBoard: (id: string) => void;
  createBoard: (title: string, color?: string, description?: string) => string;
  updateBoard: (id: string, updates: Partial<Pick<Board, "title" | "description" | "color">>) => void;
  deleteBoard: (id: string) => void;
  createList: (boardId: string, title: string) => string;
  updateList: (id: string, updates: Partial<Pick<List, "title" | "collapsed" | "archived">>) => void;
  deleteList: (boardId: string, listId: string) => void;
  reorderLists: (boardId: string, activeId: string, overId: string) => void;
  createEmployee: (name: string, email?: string) => string;
  createTask: (listId: string, title: string) => string;
  updateTask: (id: string, updates: Partial<TaskDraft & Pick<Task, "pinned" | "closed" | "archived">>) => void;
  toggleTaskClosed: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  moveTask: (taskId: string, fromListId: string, toListId: string, overTaskId?: string) => void;
  reorderTask: (listId: string, activeId: string, overId: string) => void;
  addComment: (taskId: string, text: string) => void;
  restoreTask: (taskId: string) => void;
  resetWorkspace: () => void;
}

const palette = ["#6d5dfc", "#ec4899", "#14b8a6", "#f59e0b", "#3b82f6"];
const activeBeforeClosed = (ids: string[], tasks: Record<string, Task>) => [
  ...ids.filter((id) => !tasks[id]?.closed),
  ...ids.filter((id) => tasks[id]?.closed),
];

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      ...seedData,
      hydrated: false,
      setHydrated: (hydrated) => set({ hydrated }),
      setActiveBoard: (activeBoardId) => set({ activeBoardId }),
      createBoard: (title, color, description) => {
        const id = uid("board");
        const board: Board = { id, title, description: description || "Новая рабочая доска", color: color ?? palette[Object.keys(get().boards).length % palette.length], listIds: [], createdAt: new Date().toISOString() };
        set((state) => ({ boards: { ...state.boards, [id]: board }, activeBoardId: id }));
        return id;
      },
      updateBoard: (id, updates) => set((state) => ({ boards: { ...state.boards, [id]: { ...state.boards[id], ...updates } } })),
      deleteBoard: (id) => set((state) => {
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
        set((state) => ({
          lists: { ...state.lists, [id]: { id, title, taskIds: [], collapsed: false, archived: false } },
          boards: { ...state.boards, [boardId]: { ...state.boards[boardId], listIds: [...state.boards[boardId].listIds, id] } },
        }));
        return id;
      },
      updateList: (id, updates) => set((state) => ({ lists: { ...state.lists, [id]: { ...state.lists[id], ...updates } } })),
      deleteList: (boardId, listId) => set((state) => {
        const lists = { ...state.lists };
        const tasks = { ...state.tasks };
        lists[listId]?.taskIds.forEach((taskId) => delete tasks[taskId]);
        delete lists[listId];
        return { lists, tasks, boards: { ...state.boards, [boardId]: { ...state.boards[boardId], listIds: state.boards[boardId].listIds.filter((id) => id !== listId) } } };
      }),
      reorderLists: (boardId, activeId, overId) => set((state) => {
        const ids = state.boards[boardId].listIds;
        return { boards: { ...state.boards, [boardId]: { ...state.boards[boardId], listIds: arrayMove(ids, ids.indexOf(activeId), ids.indexOf(overId)) } } };
      }),
      createEmployee: (name, email) => {
        const id = uid("employee");
        const employee: Employee = { id, name, email: email || undefined, createdAt: new Date().toISOString() };
        set((state) => ({ employees: { ...state.employees, [id]: employee } }));
        return id;
      },
      createTask: (listId, title) => {
        const id = uid("task");
        const task: Task = { id, title, description: "", priority: "medium", status: "backlog", labels: [], assigneeIds: [], comments: [], notes: "", pinned: false, closed: false, archived: false, createdAt: new Date().toISOString() };
        set((state) => ({ tasks: { ...state.tasks, [id]: task }, lists: { ...state.lists, [listId]: { ...state.lists[listId], taskIds: [...state.lists[listId].taskIds, id] } } }));
        return id;
      },
      updateTask: (id, updates) => set((state) => ({ tasks: { ...state.tasks, [id]: { ...state.tasks[id], ...updates } } })),
      toggleTaskClosed: (taskId) => set((state) => {
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
      deleteTask: (taskId) => set((state) => {
        const tasks = { ...state.tasks };
        delete tasks[taskId];
        return { tasks, lists: Object.fromEntries(Object.entries(state.lists).map(([id, list]) => [id, { ...list, taskIds: list.taskIds.filter((value) => value !== taskId) }])) };
      }),
      moveTask: (taskId, fromListId, toListId, overTaskId) => set((state) => {
        const sourceIds = state.lists[fromListId].taskIds.filter((id) => id !== taskId);
        const targetBase = fromListId === toListId ? sourceIds : state.lists[toListId].taskIds.filter((id) => id !== taskId);
        const index = overTaskId ? Math.max(0, targetBase.indexOf(overTaskId)) : targetBase.length;
        const targetIds = activeBeforeClosed([...targetBase.slice(0, index), taskId, ...targetBase.slice(index)], state.tasks);
        return { lists: { ...state.lists, [fromListId]: { ...state.lists[fromListId], taskIds: fromListId === toListId ? targetIds : activeBeforeClosed(sourceIds, state.tasks) }, [toListId]: { ...state.lists[toListId], taskIds: targetIds } } };
      }),
      reorderTask: (listId, activeId, overId) => set((state) => {
        const ids = state.lists[listId].taskIds;
        return { lists: { ...state.lists, [listId]: { ...state.lists[listId], taskIds: activeBeforeClosed(arrayMove(ids, ids.indexOf(activeId), ids.indexOf(overId)), state.tasks) } } };
      }),
      addComment: (taskId, text) => {
        const comment: Comment = { id: uid("comment"), author: "Вы", text, createdAt: new Date().toISOString() };
        set((state) => ({ tasks: { ...state.tasks, [taskId]: { ...state.tasks[taskId], comments: [...state.tasks[taskId].comments, comment] } } }));
      },
      restoreTask: (taskId) => set((state) => ({ tasks: { ...state.tasks, [taskId]: { ...state.tasks[taskId], archived: false } } })),
      resetWorkspace: () => set({ ...seedData }),
    }),
    {
      name: "flowboard-workspace-v1",
      partialize: ({ boards, lists, tasks, employees, activeBoardId }) => ({ boards, lists, tasks, employees, activeBoardId }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);
