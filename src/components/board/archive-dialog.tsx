"use client";

import { ArchiveRestore, ListTree } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { useBoardStore } from "@/store/use-board-store";

interface ArchiveDialogProps { open: boolean; onClose: () => void; canEdit: boolean; }

export function ArchiveDialog({ open, onClose, canEdit }: ArchiveDialogProps) {
  const tasks = useBoardStore((state) => state.tasks);
  const lists = useBoardStore((state) => state.lists);
  const restoreTask = useBoardStore((state) => state.restoreTask);
  const updateList = useBoardStore((state) => state.updateList);
  const archivedTasks = Object.values(tasks).filter((task) => task.archived);
  const archivedLists = Object.values(lists).filter((list) => list.archived);

  return (
    <Modal open={open} onClose={onClose} title="Архив" description="Здесь хранятся скрытые задачи и списки">
      <div className="modal-content archive-content">
        {archivedTasks.length === 0 && archivedLists.length === 0 ? <div className="archive-empty"><ArchiveRestore size={28} /><strong>Архив пуст</strong><span>Архивированные элементы появятся здесь</span></div> : <>
          {archivedTasks.map((task) => <div className="archive-row" key={task.id}><div><strong>{task.title}</strong><span>Задача</span></div>{canEdit && <button className="button secondary compact" onClick={() => { restoreTask(task.id); toast.success("Задача восстановлена"); }}><ArchiveRestore size={14} />Восстановить</button>}</div>)}
          {archivedLists.map((list) => <div className="archive-row" key={list.id}><div><strong>{list.title}</strong><span><ListTree size={13} />Список · {list.taskIds.length} задач</span></div>{canEdit && <button className="button secondary compact" onClick={() => { updateList(list.id, { archived: false }); toast.success("Список восстановлен"); }}><ArchiveRestore size={14} />Восстановить</button>}</div>)}
        </>}
      </div>
      <footer className="modal-actions"><span /><button className="button secondary" onClick={onClose}>Закрыть</button></footer>
    </Modal>
  );
}
