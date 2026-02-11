"use client";

import React from "react";
import { RiAddLine, RiDeleteBinLine, RiCheckLine, RiCloseLine } from "@remixicon/react";

import type { RSSFeedRow } from "@/lib/types/database";
import { addRSSFeed, updateRSSFeed, deleteRSSFeed } from "@/lib/actions/settings";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { cx } from "@/lib/utils";

interface RSSFeedManagerProps {
  feeds: RSSFeedRow[];
}

interface NewFeed {
  name: string;
  url: string;
}

export function RSSFeedManager({ feeds }: Readonly<RSSFeedManagerProps>) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [newFeed, setNewFeed] = React.useState<NewFeed>({ name: "", url: "" });
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValues, setEditValues] = React.useState<NewFeed>({ name: "", url: "" });
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleAdd() {
    if (!newFeed.name.trim() || !newFeed.url.trim()) {
      setError("Name and URL are required");
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await addRSSFeed(newFeed.name, newFeed.url);

    if (result.success) {
      setNewFeed({ name: "", url: "" });
      setIsAdding(false);
    } else {
      setError(result.error || "Failed to add feed");
    }

    setIsLoading(false);
  }

  async function handleUpdate(id: string) {
    if (!editValues.name.trim() || !editValues.url.trim()) {
      setError("Name and URL are required");
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await updateRSSFeed(id, {
      name: editValues.name,
      url: editValues.url,
    });

    if (result.success) {
      setEditingId(null);
    } else {
      setError(result.error || "Failed to update feed");
    }

    setIsLoading(false);
  }

  async function handleToggle(id: string, enabled: boolean) {
    const result = await updateRSSFeed(id, { enabled });
    if (!result.success) {
      setError(result.error || "Failed to update feed");
    }
  }

  async function handleDelete(id: string) {
    setIsLoading(true);
    setError(null);

    const result = await deleteRSSFeed(id);

    if (!result.success) {
      setError(result.error || "Failed to delete feed");
    }

    setIsLoading(false);
  }

  function startEditing(feed: RSSFeedRow) {
    setEditingId(feed.id);
    setEditValues({ name: feed.name, url: feed.url });
    setError(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditValues({ name: "", url: "" });
    setError(null);
  }

  function cancelAdding() {
    setIsAdding(false);
    setNewFeed({ name: "", url: "" });
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
          Add Feed
        </Button>
      )}

      {/* Add form */}
      {isAdding && (
        <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              placeholder="Feed name"
              value={newFeed.name}
              onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
              disabled={isLoading}
            />
            <Input
              placeholder="Feed URL"
              type="url"
              value={newFeed.url}
              onChange={(e) => setNewFeed({ ...newFeed, url: e.target.value })}
              disabled={isLoading}
            />
          </div>
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

      {/* Feeds list */}
      <div className="flex flex-col gap-2">
        {feeds.length === 0 && !isAdding ? (
          <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            Belum ada RSS feed. Tambahkan feed untuk memulai.
          </p>
        ) : (
          feeds.map((feed) => (
            <div
              key={feed.id}
              className={cx(
                "flex items-center gap-3 rounded-md border p-3",
                "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950",
              )}
            >
              {editingId === feed.id ? (
                // Edit mode
                <>
                  <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input
                      value={editValues.name}
                      onChange={(e) =>
                        setEditValues({ ...editValues, name: e.target.value })
                      }
                      disabled={isLoading}
                      placeholder="Feed name"
                    />
                    <Input
                      value={editValues.url}
                      onChange={(e) =>
                        setEditValues({ ...editValues, url: e.target.value })
                      }
                      disabled={isLoading}
                      placeholder="Feed URL"
                      type="url"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUpdate(feed.id)}
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
                  <div
                    className="flex flex-1 cursor-pointer flex-col gap-0.5"
                    onClick={() => startEditing(feed)}
                  >
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-50">
                      {feed.name}
                    </span>
                    <span className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {feed.url}
                    </span>
                  </div>
                  <Switch
                    checked={feed.enabled}
                    onCheckedChange={(checked) => handleToggle(feed.id, checked)}
                    size="small"
                    aria-label={feed.enabled ? "Disable feed" : "Enable feed"}
                  />
                  <button
                    type="button"
                    onClick={() => handleDelete(feed.id)}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                    aria-label="Delete feed"
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
