"use client";

import { Button } from "@/components/ui/button";

type TaskSelectionToolbarProps = {
  selectedCount: number;
  allCount: number;
  isDeleting: boolean;
  canEdit: boolean;
  showMarkInProgress: boolean;
  showMarkDone: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onEditSelected: () => void;
  onMarkInProgress: () => void;
  onMarkDone: () => void;
  onDeleteSelected: () => void;
};

export function TaskSelectionToolbar({
  selectedCount,
  allCount,
  isDeleting,
  canEdit,
  showMarkInProgress,
  showMarkDone,
  onSelectAll,
  onDeselectAll,
  onEditSelected,
  onMarkInProgress,
  onMarkDone,
  onDeleteSelected,
}: TaskSelectionToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-2 z-20 flex flex-wrap gap-2 rounded-lg border border-accent bg-accent/50 px-4 py-3 shadow-md">
      <p className="text-sm font-medium text-foreground self-center">
        {selectedCount} task{selectedCount > 1 ? "s" : ""} selected
      </p>
      <div className="flex gap-2">
        {selectedCount < allCount && (
          <Button
            size="sm"
            variant="outline"
            onClick={onSelectAll}
            className="font-semibold"
          >
            Select All
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={onDeselectAll}
          className="font-semibold"
        >
          Deselect All
        </Button>
      </div>
      <div className="ml-auto flex gap-2">
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            onClick={onEditSelected}
            className="font-semibold"
          >
            Edit Task
          </Button>
        )}
        {showMarkInProgress && (
          <Button
            size="sm"
            variant="outline"
            className="border-blue-500/40 text-blue-500 hover:bg-blue-500/10 font-semibold"
            onClick={onMarkInProgress}
          >
            Set In Progress
          </Button>
        )}
        {showMarkDone && (
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white font-semibold"
            onClick={onMarkDone}
          >
            Mark as Done
          </Button>
        )}
        <Button
          size="sm"
          variant="destructive"
          onClick={onDeleteSelected}
          disabled={isDeleting}
          className="font-semibold"
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </div>
  );
}
