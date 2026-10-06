"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Client } from "./types";

// クライアント（とその下のプロジェクト）の並びをドラッグで入れ替える一覧。
// 左端のつまみを持って動かす（キーボードでは つまみ で Space → 上下キー → Space）
export default function SortableClientList({
  clients,
  renderClient,
  onReorder,
}: {
  clients: Client[];
  renderClient: (client: Client) => React.ReactNode;
  onReorder: (next: Client[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = clients.findIndex((c) => c.id === active.id);
    const to = clients.findIndex((c) => c.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(clients, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: "Space キーで持ち上げ、上下キーで動かし、もう一度 Space キーで置きます。Esc キーで取り消します。" },
      }}
    >
      <SortableContext items={clients.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        {clients.map((c) => (
          <SortableClient key={c.id} client={c}>
            {renderClient(c)}
          </SortableClient>
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableClient({ client, children }: { client: Client; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: client.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group relative flex flex-col gap-0.5 mt-1 rounded-lg ${isDragging ? "z-10 bg-white shadow-lg ring-1 ring-app-border" : ""}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`「${client.name}」の並びを入れ替える`}
        className="absolute -left-1.5 top-0 h-9 w-4 flex items-center justify-center rounded text-app-sub/40 group-hover:text-app-sub hover:bg-app-bg bg-transparent border-none p-0 cursor-grab active:cursor-grabbing touch-none focus-visible:text-app-sub focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <GripVertical size={14} aria-hidden />
      </button>
      {children}
    </div>
  );
}
