"use client";

/**
 * WidgetGrid provides a draggable, resizable grid container for dashboard widgets.
 * Uses @hello-pangea/dnd for drag-and-drop reordering.
 * 
 * When isEditMode is true:
 * - Shows a dashed border around the grid
 * - Enables drag-and-drop and resize controls on widgets
 */

import * as React from "react";
import {
  DragDropContext,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { DraggableWidget } from "@/components/dashboard/DraggableWidget";
import { cx } from "@/lib/utils";
import type { DashboardLayout, WidgetSize } from "@/lib/types/dashboard-layout";

interface WidgetGridProps {
  layout: DashboardLayout;
  onLayoutChange: (layout: DashboardLayout) => void;
  renderWidget: (id: string) => React.ReactNode;
  isEditMode: boolean;
}

export function WidgetGrid({
  layout,
  onLayoutChange,
  renderWidget,
  isEditMode,
}: Readonly<WidgetGridProps>) {
  /**
   * Handle drag end - reorder widgets
   */
  const handleDragEnd = React.useCallback(
    (result: DropResult) => {
      const { destination, source } = result;

      // Dropped outside the list
      if (!destination) return;

      // Dropped in the same position
      if (destination.index === source.index) return;

      // Reorder the widgets array
      const newWidgets = Array.from(layout.widgets);
      const [removed] = newWidgets.splice(source.index, 1);
      newWidgets.splice(destination.index, 0, removed);

      onLayoutChange({ widgets: newWidgets });
    },
    [layout.widgets, onLayoutChange],
  );

  /**
   * Handle widget resize
   */
  const handleResize = React.useCallback(
    (id: string, newSize: WidgetSize) => {
      const newWidgets = layout.widgets.map((widget) =>
        widget.id === id ? { ...widget, size: newSize } : widget,
      );
      onLayoutChange({ widgets: newWidgets });
    },
    [layout.widgets, onLayoutChange],
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="widget-grid" direction="vertical">
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cx(
              "grid grid-cols-4 gap-4 transition-all duration-200",
              isEditMode && "rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/30 p-4 dark:border-blue-700 dark:bg-blue-950/20",
            )}
          >
            {layout.widgets.map((widget, index) => (
              <DraggableWidget
                key={widget.id}
                id={widget.id}
                index={index}
                size={widget.size}
                isEditMode={isEditMode}
                onResize={handleResize}
              >
                {renderWidget(widget.id)}
              </DraggableWidget>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
