"use client";

import React from "react";
import { RiAddLine, RiDeleteBinLine, RiCheckLine, RiCloseLine } from "@remixicon/react";

import type { TopicRow } from "@/lib/types/database";
import { addTopic, updateTopic, deleteTopic } from "@/lib/actions/settings";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { cx } from "@/lib/utils";

interface TopicManagerProps {
  topics: TopicRow[];
}

export function TopicManager({ topics }: Readonly<TopicManagerProps>) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [newTopic, setNewTopic] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleAdd() {
    if (!newTopic.trim()) {
      setError("Topic name is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await addTopic(newTopic);

    if (result.success) {
      setNewTopic("");
      setIsAdding(false);
    } else {
      setError(result.error || "Failed to add topic");
    }

    setIsLoading(false);
  }

  async function handleUpdate(id: string) {
    if (!editValue.trim()) {
      setError("Topic name is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await updateTopic(id, { name: editValue });

    if (result.success) {
      setEditingId(null);
    } else {
      setError(result.error || "Failed to update topic");
    }

    setIsLoading(false);
  }

  async function handleToggle(id: string, enabled: boolean) {
    const result = await updateTopic(id, { enabled });
    if (!result.success) {
      setError(result.error || "Failed to update topic");
    }
  }

  async function handleDelete(id: string) {
    setIsLoading(true);
    setError(null);

    const result = await deleteTopic(id);

    if (!result.success) {
      setError(result.error || "Failed to delete topic");
    }

    setIsLoading(false);
  }

  function startEditing(topic: TopicRow) {
    setEditingId(topic.id);
    setEditValue(topic.name);
    setError(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditValue("");
    setError(null);
  }

  function cancelAdding() {
    setIsAdding(false);
    setNewTopic("");
    setError(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Error message */}
      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      )}

      {/* Add button */}
      {!isAdding && (
        <Button
          variant="secondary"
          onClick={() => setIsAdding(true)}
          className="w-fit gap-2"
        >
          <RiAddLine className="size-4" />
          Add Topic
        </Button>
      )}

      {/* Add form */}
      {isAdding && (
        <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
          <Input
            placeholder="Topic name (e.g., SKK Migas, Hulu Migas)"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") cancelAdding();
            }}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Topics are used both as RapidAPI search queries and to filter RSS articles.
          </p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={handleAdd}
              disabled={isLoading}
              className="gap-2"
            >
              <RiCheckLine className="size-4" />
              Save
            </Button>
            <Button
              variant="ghost"
              onClick={cancelAdding}
              disabled={isLoading}
              className="gap-2"
            >
              <RiCloseLine className="size-4" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Topics list */}
      <div className="flex flex-col gap-2">
        {topics.length === 0 && !isAdding ? (
          <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No topics yet. Add one to start monitoring news.
          </p>
        ) : (
          topics.map((topic) => (
            <div
              key={topic.id}
              className={cx(
                "flex items-center gap-3 rounded-md border p-3",
                "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950",
              )}
            >
              {editingId === topic.id ? (
                // Edit mode
                <>
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    disabled={isLoading}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdate(topic.id);
                      if (e.key === "Escape") cancelEditing();
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdate(topic.id)}
                    disabled={isLoading}
                    className="rounded-md p-1.5 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                    aria-label="Save"
                  >
                    <RiCheckLine className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={isLoading}
                    className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    aria-label="Cancel"
                  >
                    <RiCloseLine className="size-4" />
                  </button>
                </>
              ) : (
                // View mode
                <>
                  <span
                    className="flex-1 cursor-pointer text-sm font-medium text-gray-900 dark:text-gray-50"
                    onClick={() => startEditing(topic)}
                  >
                    {topic.name}
                  </span>
                  <Switch
                    checked={topic.enabled}
                    onCheckedChange={(checked) => handleToggle(topic.id, checked)}
                    size="small"
                    aria-label={topic.enabled ? "Disable topic" : "Enable topic"}
                  />
                  <button
                    type="button"
                    onClick={() => handleDelete(topic.id)}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                    aria-label="Delete topic"
                  >
                    <RiDeleteBinLine className="size-4" />
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
