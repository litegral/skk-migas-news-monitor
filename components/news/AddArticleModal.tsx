"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { RiArticleLine } from "@remixicon/react";

import { addCustomArticleAction } from "@/app/actions/articles";
import type { TopicRow } from "@/lib/types/database";
import type { Sentiment } from "@/lib/types/news";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogCloseButton,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { cx, focusInput } from "@/lib/utils";

interface AddArticleModalProps {
  /** Used only to detect whether any topic is enabled (feed visibility). */
  topics: TopicRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PresetSentiment = "" | Sentiment;

export function AddArticleModal({
  topics,
  open,
  onOpenChange,
}: Readonly<AddArticleModalProps>) {
  const router = useRouter();

  const hasEnabledTopic = React.useMemo(
    () => topics.some((t) => t.enabled),
    [topics],
  );

  const [title, setTitle] = React.useState("");
  const [link, setLink] = React.useState("");
  const [sourceName, setSourceName] = React.useState("");
  const [presetSentiment, setPresetSentiment] = React.useState<PresetSentiment>("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const resetFormStable = React.useCallback(() => {
    setTitle("");
    setLink("");
    setSourceName("");
    setPresetSentiment("");
    setError(null);
  }, []);

  React.useEffect(() => {
    if (!open) {
      resetFormStable();
    }
  }, [open, resetFormStable]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    setIsLoading(true);
    const result = await addCustomArticleAction({
      title,
      link,
      sourceName,
      sentiment: presetSentiment === "" ? undefined : presetSentiment,
    });
    setIsLoading(false);

    if (result.success) {
      resetFormStable();
      onOpenChange(false);
      router.refresh();
    } else {
      setError(result.error ?? "Failed to save");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogCloseButton />
        <DialogHeader>
          <DialogTitle>Tambah artikel manual</DialogTitle>
          <DialogDescription>
            Ringkasan dan kategori diisi oleh AI setelah halaman di-crawl. Topik feed ditetapkan
            otomatis ke semua topik yang aktif.
          </DialogDescription>
        </DialogHeader>

        {!hasEnabledTopic ? (
          <div className="flex items-start gap-3 py-2">
            <RiArticleLine className="mt-0.5 size-5 shrink-0 text-gray-400" aria-hidden />
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Aktifkan setidaknya satu topik di pengaturan agar artikel bisa muncul di feed.
            </p>
          </div>
        ) : (
          <form id="add-article-modal-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="modal-add-link">URL artikel</Label>
              <Input
                id="modal-add-link"
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
              <Label htmlFor="modal-add-title">Judul</Label>
              <Input
                id="modal-add-title"
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
              <Label htmlFor="modal-add-media">Nama media</Label>
              <Input
                id="modal-add-media"
                name="sourceName"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="Mis. Kompas, Tempo, dll."
                required
                disabled={isLoading}
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="modal-add-sentiment">Sentimen (opsional)</Label>
              <select
                id="modal-add-sentiment"
                name="presetSentiment"
                value={presetSentiment}
                onChange={(e) => setPresetSentiment(e.target.value as PresetSentiment)}
                disabled={isLoading}
                className={cx(
                  "w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm shadow-xs",
                  "text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50",
                  focusInput,
                )}
              >
                <option value="">Biarkan AI</option>
                <option value="positive">Positif</option>
                <option value="neutral">Netral</option>
                <option value="negative">Negatif</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Jika dipilih, label ini dipertahankan setelah analisis AI (ringkasan/kategori tetap
                diperbarui).
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}
          </form>
        )}

        {hasEnabledTopic && (
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Batal
            </Button>
            <Button type="submit" form="add-article-modal-form" isLoading={isLoading} disabled={isLoading}>
              Simpan artikel
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
