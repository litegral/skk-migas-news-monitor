"use client";

import React from "react";
import {
  RiAddLine,
  RiDeleteBinLine,
  RiCheckLine,
  RiCloseLine,
  RiEditLine,
} from "@remixicon/react";

import type { TopicRow } from "@/lib/types/database";
import { addTopic, updateTopic, deleteTopic } from "@/lib/actions/settings";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { cx } from "@/lib/utils";

interface TopicManagerProps {
  topics: TopicRow[];
}

interface TopicFormData {
  name: string;
  keywords: string[];
}

export function TopicManager({ topics }: Readonly<TopicManagerProps>) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [newTopic, setNewTopic] = React.useState<TopicFormData>({
    name: "",
    keywords: [],
  });
  const [newKeyword, setNewKeyword] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState<TopicFormData>({
    name: "",
    keywords: [],
  });
  const [editKeyword, setEditKeyword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // =====================
  // Add topic handlers
  // =====================

  function addKeywordToNew() {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;
    if (newTopic.keywords.includes(trimmed)) {
      setError("Kata kunci sudah ditambahkan");
      return;
    }
    setNewTopic({ ...newTopic, keywords: [...newTopic.keywords, trimmed] });
    setNewKeyword("");
    setError(null);
  }

  function removeKeywordFromNew(keyword: string) {
    setNewTopic({
      ...newTopic,
      keywords: newTopic.keywords.filter((k) => k !== keyword),
    });
  }

  async function handleAdd() {
    if (!newTopic.name.trim()) {
      setError("Nama topik wajib diisi");
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await addTopic(newTopic.name, newTopic.keywords);

    if (result.success) {
      setNewTopic({ name: "", keywords: [] });
      setNewKeyword("");
      setIsAdding(false);
    } else {
      setError(result.error || "Gagal menambah topik");
    }

    setIsLoading(false);
  }

  function cancelAdding() {
    setIsAdding(false);
    setNewTopic({ name: "", keywords: [] });
    setNewKeyword("");
    setError(null);
  }

  // =====================
  // Edit topic handlers
  // =====================

  function startEditing(topic: TopicRow) {
    setEditingId(topic.id);
    setEditValue({
      name: topic.name,
      keywords: topic.keywords ?? [],
    });
    setEditKeyword("");
    setError(null);
  }

  function addKeywordToEdit() {
    const trimmed = editKeyword.trim();
    if (!trimmed) return;
    if (editValue.keywords.includes(trimmed)) {
      setError("Kata kunci sudah ditambahkan");
      return;
    }
    setEditValue({ ...editValue, keywords: [...editValue.keywords, trimmed] });
    setEditKeyword("");
    setError(null);
  }

  function removeKeywordFromEdit(keyword: string) {
    setEditValue({
      ...editValue,
      keywords: editValue.keywords.filter((k) => k !== keyword),
    });
  }

  async function handleUpdate(id: string) {
    if (!editValue.name.trim()) {
      setError("Nama topik wajib diisi");
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await updateTopic(id, {
      name: editValue.name,
      keywords: editValue.keywords,
    });

    if (result.success) {
      setEditingId(null);
      setEditValue({ name: "", keywords: [] });
      setEditKeyword("");
    } else {
      setError(result.error || "Gagal memperbarui topik");
    }

    setIsLoading(false);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditValue({ name: "", keywords: [] });
    setEditKeyword("");
    setError(null);
  }

  // =====================
  // Toggle and delete
  // =====================

  async function handleToggle(id: string, enabled: boolean) {
    const result = await updateTopic(id, { enabled });
    if (!result.success) {
      setError(result.error || "Gagal memperbarui topik");
    }
  }

  async function handleDelete(id: string) {
    setIsLoading(true);
    setError(null);

    const result = await deleteTopic(id);

    if (!result.success) {
      setError(result.error || "Gagal menghapus topik");
    }

    setIsLoading(false);
  }

  // =====================
  // Keyword tag component
  // =====================

  function KeywordTag({
    keyword,
    onRemove,
    disabled,
  }: Readonly<{
    keyword: string;
    onRemove: () => void;
    disabled?: boolean;
  }>) {
    return (
      <span
        className={cx(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
          "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
        )}
      >
        {keyword}
        {!disabled && (
          <button
            type="button"
            onClick={onRemove}
            className="ml-0.5 rounded-full p-0.5 hover:bg-blue-100 dark:hover:bg-blue-800"
            aria-label={`Hapus kata kunci ${keyword}`}
          >
            <RiCloseLine className="size-3" />
          </button>
        )}
      </span>
    );
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
            placeholder="Nama topik (contoh: SKK Migas)"
            value={newTopic.name}
            onChange={(e) => setNewTopic({ ...newTopic, name: e.target.value })}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancelAdding();
            }}
          />

          {/* Keywords section */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Kata Kunci (opsional) - Cocokkan artikel jika mengandung salah satu kata kunci
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Tambah kata kunci..."
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                disabled={isLoading}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeywordToNew();
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={addKeywordToNew}
                disabled={isLoading || !newKeyword.trim()}
              >
                <RiAddLine className="size-4" />
              </Button>
            </div>
            {newTopic.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {newTopic.keywords.map((kw) => (
                  <KeywordTag
                    key={kw}
                    keyword={kw}
                    onRemove={() => removeKeywordFromNew(kw)}
                    disabled={isLoading}
                  />
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Topik digunakan untuk pencarian RapidAPI dan filter artikel RSS.
            Jika kata kunci kosong, nama topik akan digunakan untuk pencocokan.
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
            Belum ada topik. Tambahkan topik untuk mulai memantau berita.
          </p>
        ) : (
          topics.map((topic) => (
            <div
              key={topic.id}
              className={cx(
                "flex flex-col gap-2 rounded-md border p-3",
                "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
              )}
            >
              {editingId === topic.id ? (
                // Edit mode
                <div className="flex flex-col gap-3">
                  <Input
                    value={editValue.name}
                    onChange={(e) =>
                      setEditValue({ ...editValue, name: e.target.value })
                    }
                    disabled={isLoading}
                    placeholder="Nama topik"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Escape") cancelEditing();
                    }}
                  />

                  {/* Keywords section */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Kata Kunci
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Tambah kata kunci..."
                        value={editKeyword}
                        onChange={(e) => setEditKeyword(e.target.value)}
                        disabled={isLoading}
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addKeywordToEdit();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={addKeywordToEdit}
                        disabled={isLoading || !editKeyword.trim()}
                      >
                        <RiAddLine className="size-4" />
                      </Button>
                    </div>
                    {editValue.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {editValue.keywords.map((kw) => (
                          <KeywordTag
                            key={kw}
                            keyword={kw}
                            onRemove={() => removeKeywordFromEdit(kw)}
                            disabled={isLoading}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      onClick={() => handleUpdate(topic.id)}
                      disabled={isLoading}
                      className="gap-2"
                    >
                      <RiCheckLine className="size-4" />
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={cancelEditing}
                      disabled={isLoading}
                      className="gap-2"
                    >
                      <RiCloseLine className="size-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                // View mode
                <>
                  <div className="flex items-center gap-3">
                    <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-50">
                      {topic.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEditing(topic)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                      aria-label="Edit topik"
                    >
                      <RiEditLine className="size-4" />
                    </button>
                    <Switch
                      checked={topic.enabled}
                      onCheckedChange={(checked) =>
                        handleToggle(topic.id, checked)
                      }
                      size="small"
                      aria-label={
                        topic.enabled ? "Nonaktifkan topik" : "Aktifkan topik"
                      }
                    />
                    <button
                      type="button"
                      onClick={() => handleDelete(topic.id)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                      aria-label="Hapus topik"
                    >
                      <RiDeleteBinLine className="size-4" />
                    </button>
                  </div>
                  {/* Show keywords if any */}
                  {topic.keywords && topic.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {topic.keywords.map((kw) => (
                        <span
                          key={kw}
                          className={cx(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                          )}
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
