"use client";

import { CalendarDays, CheckCircle2, ListChecks, SearchX } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { priorityMeta, statusMeta } from "@/lib/utils";
import { sortTasks, taskMatches, type TaskSort } from "@/lib/task-filter";
import { useBoardStore } from "@/store/use-board-store";
import type { Filters, Task } from "@/types/board";

interface TaskTableProps {
  boardId: string;
  search: string;
  filters: Filters;
  sort: TaskSort;
  onOpenTask: (id: string) => void;
}

export function TaskTable({ boardId, search, filters, sort, onOpenTask }: TaskTableProps) {
  const board = useBoardStore((state) => state.boards[boardId]);
  const lists = useBoardStore((state) => state.lists);
  const tasks = useBoardStore((state) => state.tasks);

  if (!board) return null;

  const listByTask = new Map<string, string>();
  const boardTasks = board.listIds.flatMap((listId) => {
    const list = lists[listId];
    if (!list || list.archived) return [];
    return list.taskIds.flatMap((taskId) => {
      const task = tasks[taskId];
      if (!task || !taskMatches(task, search, filters, list.title)) return [];
      listByTask.set(taskId, list.title);
      return [task];
    });
  });
  const visibleTasks = sortTasks(boardTasks, sort);

  if (visibleTasks.length === 0) {
    return <div className="table-empty"><SearchX size={28} /><strong>Задачи не найдены</strong><span>Измените фильтры или добавьте задачу на доску</span></div>;
  }

  return (
    <div className="task-table-wrap">
      <table className="task-table">
        <thead><tr><th>Задача</th><th>Список</th><th>Статус</th><th>Приоритет</th><th>Дедлайн</th><th>Метки</th></tr></thead>
        <tbody>
          {visibleTasks.map((task: Task) => (
            <tr key={task.id} onClick={() => onOpenTask(task.id)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && onOpenTask(task.id)}>
              <td><div className="table-task-title"><span className="table-priority-dot" style={{ background: priorityMeta[task.priority].color }} />{task.status === "done" ? <CheckCircle2 size={15} /> : <ListChecks size={15} />}<strong>{task.title}</strong></div>{task.description && <small>{task.description}</small>}</td>
              <td><span className="table-list-chip">{listByTask.get(task.id)}</span></td>
              <td><span className={`status-chip status-${task.status}`}>{statusMeta[task.status]}</span></td>
              <td><span className="priority-chip"><i style={{ background: priorityMeta[task.priority].color }} />{priorityMeta[task.priority].label}</span></td>
              <td>{task.dueDate ? <span className="table-date"><CalendarDays size={13} />{format(new Date(`${task.dueDate}T12:00:00`), "d MMM yyyy", { locale: ru })}</span> : <span className="table-muted">Без срока</span>}</td>
              <td><div className="table-labels">{task.labels.slice(0, 2).map((label) => <span key={label}>{label}</span>)}{task.labels.length > 2 && <b>+{task.labels.length - 2}</b>}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
