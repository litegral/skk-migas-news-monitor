"use client";

import React from "react";
import { RiArticleLine } from "@remixicon/react";

import { addCustomArticleAction } from "@/app/actions/articles";
import type { TopicRow } from "@/lib/types/database";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { cx, focusInput } from "@/lib/utils";

interface CustomArticleFormProps {
  topics: TopicRow[];
}

export function CustomArticleForm({ topics }: Readonly<CustomArticleFormProps>) {
  const enabledTopics = React.useMemo(
    () => topics.filter((t) => t.enabled).sort((a, b) => a.name.localeCompare(b.name)),
    [topics],
  );

  const topicNames = React.useMemo(
    () => enabledTopics.map((t) => t.name),
    [enabledTopics],
  );

  const nameToId = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const t of enabledTopics) {
      m.set(t.name, t.id);
    }
    return m;
  }, [enabledTopics]);

  const [title, setTitle] = React.useState("");
  const [link, setLink] = React.useState("");
  const [snippet, setSnippet] = React.useState("");
  const [sourceName, setSourceName] = React.useState("");
  const [publishedAt, setPublishedAt] = React.useState("");
  const [selectedTopicNames, setSelectedTopicNames] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const topicIds = selectedTopicNames
      .map((name) => nameToId.get(name))
      .filter((id): id is string => Boolean(id));

    if (topicIds.length === 0) {
      setError("Pilih setidaknya satu topik");
      return;
    }

    setIsLoading(true);
    const result = await addCustomArticleAction({
      title,
      link,
      snippet: snippet.trim() === "" ? undefined : snippet,
      sourceName: sourceName.trim() === "" ? undefined : sourceName,
      publishedAt: publishedAt.trim() === "" ? null : publishedAt,
      topicIds,
    });
    setIsLoading(false);

    if (result.success) {
      setSuccess(true);
      setTitle("");
      setLink("");
      setSnippet("");
      setSourceName("");
      setPublishedAt("");
      setSelectedTopicNames([]);
    } else {
      setError(result.error ?? "Failed to save");
    }
  }

  if (enabledTopics.length === 0) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <RiArticleLine className="mt-0.5 size-5 shrink-0 text-gray-400" aria-hidden />
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
              Tambah artikel manual
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Aktifkan setidaknya satu topik di atas untuk menambahkan artikel ke feed.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card id="custom-article">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
        Tambah artikel manual
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Simpan URL berita untuk dianalisis (decode URL jika perlu, crawl, ringkas/sentimen lewat
        pipeline yang sama dengan sumber otomatis). Pilih topik agar artikel muncul di dashboard.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="custom-title">Judul</Label>
          <Input
            id="custom-title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Judul artikel"
            required
            disabled={isLoading}
            maxLength={500}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="custom-link">URL artikel</Label>
          <Input
            id="custom-link"
            name="link"
            type="url"
            inputMode="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://..."
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="custom-snippet">Ringkasan / kutipan (opsional)</Label>
          <textarea
            id="custom-snippet"
            name="snippet"
            value={snippet}
            onChange={(e) => setSnippet(e.target.value)}
            placeholder="Cuplikan teks jika ada"
            disabled={isLoading}
            rows={3}
            maxLength={1000}
            className={cx(
              "w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm shadow-xs",
              "text-gray-900 placeholder-gray-400 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50",
              "dark:placeholder-gray-500",
              focusInput,
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="custom-source">Nama sumber (opsional)</Label>
            <Input
              id="custom-source"
              name="sourceName"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="Mis. Media Indonesia"
              disabled={isLoading}
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-published">Tanggal terbit (opsional)</Label>
            <Input
              id="custom-published"
              name="publishedAt"
              type="datetime-local"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Topik</Label>
          <MultiSelect
            options={topicNames}
            selected={selectedTopicNames}
            onChange={setSelectedTopicNames}
            placeholder="Pilih satu atau lebih topik"
            emptyText="Tidak ada topik aktif."
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Artikel hanya tampil di feed jika cocok dengan topik yang dipilih.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-green-600 dark:text-green-400" role="status">
            Artikel disimpan. Sinkronkan dari dashboard untuk decode dan analisis AI.
          </p>
        )}

        <Button type="submit" isLoading={isLoading} disabled={isLoading}>
          Simpan artikel
        </Button>
      </form>
    </Card>
  );
}
