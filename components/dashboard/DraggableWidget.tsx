"use client";

/**
 * DraggableWidget wraps dashboard widgets with drag handle and resize menu.
 * Controls are only visible when isEditMode is true and on hover.
 */

import * as React from "react";
import { Draggable } from "@hello-pangea/dnd";
import {
  RiDraggable,
  RiSettings3Line,
} from "@remixicon/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { cx } from "@/lib/utils";
import type { WidgetSize } from "@/lib/types/dashboard-layout";
import { SIZE_LABELS } from "@/lib/types/dashboard-layout";

interface DraggableWidgetProps {
  id: string;
  index: number;
  size: WidgetSize;
  isEditMode: boolean;
  onResize: (id: string, size: WidgetSize) => void;
  children: React.ReactNode;
}

/** CSS classes for grid column spans */
const sizeClasses: Record<WidgetSize, string> = {
  sm: "col-span-1",
  md: "col-span-2",
  lg: "col-span-4",
};

export function DraggableWidget({
  id,
  index,
  size,
  isEditMode,
  onResize,
  children,
}: Readonly<DraggableWidgetProps>) {
  return (
    <Draggable draggableId={id} index={index} isDragDisabled={!isEditMode}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cx(
            sizeClasses[size],
            "group relative",
            snapshot.isDragging && "z-50",
          )}
        >
          {/* Hover overlay - only in edit mode */}
          {isEditMode && (
            <div
              className={cx(
                "absolute -inset-1 z-10 rounded-lg border-2 border-dashed border-transparent transition-colors",
                "group-hover:border-blue-300 dark:group-hover:border-blue-700",
                snapshot.isDragging && "border-blue-500 dark:border-blue-500",
              )}
            />
          )}

          {/* Drag handle - only in edit mode, visible on hover */}
          {isEditMode && (
            <div
              {...provided.dragHandleProps}
              className={cx(
                "absolute -left-1 -top-1 z-20 cursor-grab rounded-md bg-white p-1 shadow-sm ring-1 ring-gray-200",
                "opacity-0 transition-opacity group-hover:opacity-100",
                "dark:bg-gray-900 dark:ring-gray-700",
                "hover:bg-gray-50 dark:hover:bg-gray-800",
                snapshot.isDragging && "cursor-grabbing opacity-100",
              )}
              title="Drag to reorder"
            >
              <RiDraggable className="size-4 text-gray-500 dark:text-gray-400" />
            </div>
          )}

          {/* Hidden drag handle when not in edit mode (required by library) */}
          {!isEditMode && (
            <div {...provided.dragHandleProps} style={{ display: "none" }} />
          )}

          {/* Resize menu - only in edit mode, visible on hover */}
          {isEditMode && (
            <div
              className={cx(
                "absolute -right-1 -top-1 z-20",
                "opacity-0 transition-opacity group-hover:opacity-100",
              )}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cx(
                      "rounded-md bg-white p-1 shadow-sm ring-1 ring-gray-200",
                      "dark:bg-gray-900 dark:ring-gray-700",
                      "hover:bg-gray-50 dark:hover:bg-gray-800",
                      "focus:outline-none focus:ring-2 focus:ring-blue-500",
                    )}
                    title="Resize widget"
                  >
                    <RiSettings3Line className="size-4 text-gray-500 dark:text-gray-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuRadioGroup
                    value={size}
                    onValueChange={(value) => onResize(id, value as WidgetSize)}
                  >
                    {(Object.keys(SIZE_LABELS) as WidgetSize[]).map((sizeOption) => (
                      <DropdownMenuRadioItem key={sizeOption} value={sizeOption}>
                        {SIZE_LABELS[sizeOption]}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Widget content */}
          <div className="relative">{children}</div>
        </div>
      )}
    </Draggable>
  );
}
