"use client";

import React from "react";
import { RiAddLine, RiDeleteBinLine, RiCheckLine, RiCloseLine } from "@remixicon/react";

import type { SearchQueryRow } from "@/lib/types/database";
import { addSearchQuery, updateSearchQuery, deleteSearchQuery } from "@/lib/actions/settings";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { cx } from "@/lib/utils";

interface SearchQueryManagerProps {
  queries: SearchQueryRow[];
}

export function SearchQueryManager({ queries }: Readonly<SearchQueryManagerProps>) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [newQuery, setNewQuery] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleAdd() {
    if (!newQuery.trim()) {
      setError("Query text is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await addSearchQuery(newQuery);

    if (result.success) {
      setNewQuery("");
      setIsAdding(false);
    } else {
      setError(result.error || "Failed to add query");
    }

    setIsLoading(false);
  }

  async function handleUpdate(id: string) {
    if (!editValue.trim()) {
      setError("Query text is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await updateSearchQuery(id, { query: editValue });

    if (result.success) {
      setEditingId(null);
    } else {
      setError(result.error || "Failed to update query");
    }

    setIsLoading(false);
  }

  async function handleToggle(id: string, enabled: boolean) {
    const result = await updateSearchQuery(id, { enabled });
    if (!result.success) {
      setError(result.error || "Failed to update query");
    }
  }

  async function handleDelete(id: string) {
    setIsLoading(true);
    setError(null);

    const result = await deleteSearchQuery(id);

    if (!result.success) {
      setError(result.error || "Failed to delete query");
    }

    setIsLoading(false);
  }

  function startEditing(query: SearchQueryRow) {
    setEditingId(query.id);
    setEditValue(query.query);
    setError(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditValue("");
    setError(null);
  }

  function cancelAdding() {
    setIsAdding(false);
    setNewQuery("");
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
          Add Query
        </Button>
      )}

      {/* Add form */}
      {isAdding && (
        <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
          <Input
            placeholder="Search query (e.g., SKK Migas Kalsul)"
            value={newQuery}
            onChange={(e) => setNewQuery(e.target.value)}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") cancelAdding();
            }}
          />
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

      {/* Queries list */}
      <div className="flex flex-col gap-2">
        {queries.length === 0 && !isAdding ? (
          <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No search queries yet. Add one to get started.
          </p>
        ) : (
          queries.map((query) => (
            <div
              key={query.id}
              className={cx(
                "flex items-center gap-3 rounded-md border p-3",
                "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950",
              )}
            >
              {editingId === query.id ? (
                // Edit mode
                <>
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    disabled={isLoading}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdate(query.id);
                      if (e.key === "Escape") cancelEditing();
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdate(query.id)}
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
                    onClick={() => startEditing(query)}
                  >
                    {query.query}
                  </span>
                  <Switch
                    checked={query.enabled}
                    onCheckedChange={(checked) => handleToggle(query.id, checked)}
                    size="small"
                    aria-label={query.enabled ? "Disable query" : "Enable query"}
                  />
                  <button
                    type="button"
                    onClick={() => handleDelete(query.id)}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                    aria-label="Delete query"
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
