"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  RiAlertLine,
  RiCheckLine,
  RiExternalLinkLine,
  RiLoader4Line,
} from "@remixicon/react";

import {
  getFailedArticlesAction,
  updateArticleSentimentAction,
} from "@/app/actions/articles";
import type { Article, Sentiment } from "@/lib/types/news";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogCloseButton,
} from "@/components/ui/Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { SentimentBadge } from "@/components/news/SentimentBadge";

const SENTIMENT_OPTIONS = [
  { value: "positive" as const, label: "Positif" },
  { value: "neutral" as const, label: "Netral" },
  { value: "negative" as const, label: "Negatif" },
];

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

interface FailedArticlesReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FailedArticlesReviewModal({
  open,
  onOpenChange,
}: Readonly<FailedArticlesReviewModalProps>) {
  const router = useRouter();
  const [articles, setArticles] = React.useState<Article[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isLoadingList, setIsLoadingList] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const loadFailed = React.useCallback(async () => {
    setIsLoadingList(true);
    setLoadError(null);
    const res = await getFailedArticlesAction();
    setIsLoadingList(false);
    if (res.error) {
      setLoadError(res.error);
      setArticles([]);
      return;
    }
    setArticles(res.articles);
  }, []);

  React.useEffect(() => {
    if (open) {
      void loadFailed();
    }
  }, [open, loadFailed]);

  async function handleSentiment(articleId: string, sentiment: Sentiment) {
    setPendingId(articleId);
    const res = await updateArticleSentimentAction(articleId, sentiment);
    setPendingId(null);
    if (res.success) {
      setArticles((prev) => prev.filter((a) => a.id !== articleId));
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 p-0">
        <div className="border-b border-gray-200 p-6 pb-4 dark:border-gray-800">
          <DialogCloseButton />
          <DialogHeader>
            <DialogTitle className="pr-8">Tinjau analisis gagal</DialogTitle>
            <DialogDescription>
              Pilih sentimen untuk setiap artikel agar keluar dari daftar gagal. Kesalahan teknis
              (mis. situs tidak dapat dijangkau) dapat ditandai secara manual di sini.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {isLoadingList && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
              <RiLoader4Line className="size-5 animate-spin" />
              Memuat artikel…
            </div>
          )}

          {!isLoadingList && loadError && (
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
          )}

          {!isLoadingList && !loadError && articles.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Tidak ada artikel dengan analisis gagal.
            </p>
          )}

          {!isLoadingList && !loadError && articles.length > 0 && (
            <ul className="flex flex-col gap-4">
              {articles.map((article) => {
                const id = article.id!;
                const err = article.aiError ?? "";
                const busy = pendingId === id;
                return (
                  <li
                    key={id}
                    className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <a
                          href={article.decodedUrl || article.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-start gap-1.5 text-sm font-medium text-gray-900 hover:text-blue-600 dark:text-gray-50 dark:hover:text-blue-400"
                        >
                          <span className="line-clamp-2">{article.title}</span>
                          <RiExternalLinkLine className="size-4 shrink-0 opacity-60" />
                        </a>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-200/90">
                              <RiAlertLine className="mt-0.5 size-3.5 shrink-0" />
                              <span className="line-clamp-3">{truncateText(err, 220)}</span>
                            </p>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-md">
                            {err}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 pt-1 sm:pt-0">
                        <SentimentBadge sentiment={article.sentiment} />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={busy}
                              className="gap-1.5"
                            >
                              {busy ? (
                                <RiLoader4Line className="size-4 animate-spin" />
                              ) : (
                                "Atur sentimen"
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[10rem]">
                            <DropdownMenuLabel className="text-xs font-normal text-gray-500 dark:text-gray-400">
                              Pilih sentimen
                            </DropdownMenuLabel>
                            {SENTIMENT_OPTIONS.map(({ value, label }) => {
                              const selected = article.sentiment === value;
                              return (
                                <DropdownMenuItem
                                  key={value}
                                  disabled={busy}
                                  className="gap-2"
                                  onSelect={() => {
                                    void handleSentiment(id, value);
                                  }}
                                >
                                  <span className="flex w-4 items-center justify-center">
                                    {selected && (
                                      <RiCheckLine className="size-4 text-blue-600 dark:text-blue-400" />
                                    )}
                                  </span>
                                  {label}
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-200 px-6 py-4 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
