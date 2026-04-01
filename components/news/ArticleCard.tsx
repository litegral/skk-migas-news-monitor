"use client";

import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { useTransition } from "react";
import {
  RiAlertLine,
  RiCheckLine,
  RiExternalLinkLine,
  RiHashtag,
  RiInformationLine,
  RiMore2Fill,
} from "@remixicon/react";

import type { Article, Sentiment } from "@/lib/types/news";
import { updateArticleSentimentAction } from "@/app/actions/articles";
import { Card } from "@/components/ui/Card";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/Tooltip";
import { Badge } from "@/components/ui/Badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { SentimentBadge } from "./SentimentBadge";
import { CategoryBadge } from "./CategoryBadge";
import { cx } from "@/lib/utils";

interface ArticleCardProps {
  article: Article;
  /** Map of topic ID → topic name for resolving matchedTopicIds */
  topicMap?: Record<string, string>;
  /** Called after the user successfully updates sentiment (for parent list state). */
  onSentimentUpdated?: (
    articleId: string,
    sentiment: Sentiment,
  ) => void;
}

export function ArticleCard({ article, topicMap, onSentimentUpdated }: Readonly<ArticleCardProps>) {
  const [isSentimentPending, startSentimentTransition] = useTransition();

  const publishedDate = article.publishedAt
    ? formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })
    : null;

  // Resolve topic IDs to names
  const topicNames = article.matchedTopicIds
    ?.map((id) => topicMap?.[id])
    .filter((name): name is string => Boolean(name)) ?? [];

  function handleSentimentChange(next: Sentiment) {
    const articleId = article.id;
    if (!articleId) return;
    startSentimentTransition(async () => {
      const res = await updateArticleSentimentAction(articleId, next);
      if (res.success) {
        onSentimentUpdated?.(articleId, next);
      }
    });
  }

  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row">
      {/* Thumbnail */}
      {article.photoUrl && (
        <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-md sm:h-24 sm:w-32">
          <Image
            src={article.photoUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 128px"
          />
        </div>
      )}

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Title + external link */}
        <div className="flex items-start gap-2">
          <a
            href={article.decodedUrl || article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex-1"
          >
            <h3 className="line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-blue-600 dark:text-gray-50 dark:group-hover:text-blue-400">
              {article.title}
            </h3>
          </a>
          <a
            href={article.decodedUrl || article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Open article in new tab"
          >
            <RiExternalLinkLine className="size-4" />
          </a>
        </div>

        {/* Source + date */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          {article.sourceType === "custom" && (
            <Badge variant="neutral" className="px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide">
              Manual
            </Badge>
          )}
          {article.sourceName && <span>{article.sourceName}</span>}
          {article.sourceName && publishedDate && (
            <span aria-hidden="true">·</span>
          )}
          {publishedDate && <span>{publishedDate}</span>}
        </div>

        {/* Summary or snippet */}
        <p className="line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
          {article.summary || article.snippet || "Tidak ada deskripsi tersedia."}
        </p>

        {article.aiError && (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-200/90">
                <RiAlertLine className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span className="line-clamp-2">
                  Analisis gagal: {article.aiError.length > 160 ? `${article.aiError.slice(0, 160)}…` : article.aiError}
                </span>
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-md">
              {article.aiError}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Matched topics */}
        {topicNames.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <RiHashtag className="size-3 text-gray-400" />
            {topicNames.slice(0, 3).map((name) => (
              <span
                key={name}
                className={cx(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                  "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
                )}
              >
                {name}
              </span>
            ))}
            {topicNames.length > 3 && (
              <span className="text-xs text-gray-400">
                +{topicNames.length - 3} lainnya
              </span>
            )}
          </div>
        )}

        {/* Sentiment and category badges */}
        <div className="flex flex-wrap items-center gap-2">
          {article.aiReason && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label="Alasan klasifikasi AI"
                >
                  <RiInformationLine className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {article.aiReason}
              </TooltipContent>
            </Tooltip>
          )}
          <SentimentBadge sentiment={article.sentiment} />
          {article.id && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={isSentimentPending}
                      className={cx(
                        "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-gray-400",
                        "transition-colors hover:bg-gray-100 hover:text-gray-700",
                        "dark:hover:bg-gray-800 dark:hover:text-gray-200",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                        "dark:focus-visible:ring-offset-gray-950",
                        isSentimentPending && "cursor-wait opacity-60",
                        article.sentimentManuallyOverridden &&
                          "text-blue-600 dark:text-blue-400",
                      )}
                      aria-label="Ubah sentimen"
                    >
                      <RiMore2Fill className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {!article.aiProcessed
                    ? "Pilih sentimen — akan dipertahankan saat analisis AI"
                    : article.sentimentManuallyOverridden
                      ? "Sentimen disesuaikan manual — klik untuk mengubah"
                      : "Ubah sentimen"}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="min-w-[10rem]">
                <DropdownMenuLabel className="text-xs font-normal text-gray-500 dark:text-gray-400">
                  Sentimen
                </DropdownMenuLabel>
                {(
                  [
                    { value: "positive" as const, label: "Positif" },
                    { value: "neutral" as const, label: "Netral" },
                    { value: "negative" as const, label: "Negatif" },
                  ] as const
                ).map(({ value, label }) => {
                  const selected = article.sentiment === value;
                  return (
                    <DropdownMenuItem
                      key={value}
                      disabled={isSentimentPending}
                      className="gap-2"
                      onSelect={() => {
                        handleSentimentChange(value);
                      }}
                    >
                      <span className="flex w-4 items-center justify-center">
                        {selected && <RiCheckLine className="size-4 text-blue-600 dark:text-blue-400" />}
                      </span>
                      {label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {article.categories?.slice(0, 3).map((category) => (
            <CategoryBadge key={category} category={category} />
          ))}
          {article.categories && article.categories.length > 3 && (
            <span className="text-xs text-gray-400">
              +{article.categories.length - 3} lainnya
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
