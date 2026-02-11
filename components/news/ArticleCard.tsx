import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { RiExternalLinkLine } from "@remixicon/react";

import type { Article } from "@/lib/types/news";
import { Card } from "@/components/ui/Card";
import { SentimentBadge } from "./SentimentBadge";
import { CategoryBadge } from "./CategoryBadge";

interface ArticleCardProps {
  article: Article;
}

export function ArticleCard({ article }: Readonly<ArticleCardProps>) {
  const publishedDate = article.publishedAt
    ? formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })
    : null;

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
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex-1"
          >
            <h3 className="line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-blue-600 dark:text-gray-50 dark:group-hover:text-blue-400">
              {article.title}
            </h3>
          </a>
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Open article in new tab"
          >
            <RiExternalLinkLine className="size-4" />
          </a>
        </div>

        {/* Source + date */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          {article.sourceName && <span>{article.sourceName}</span>}
          {article.sourceName && publishedDate && (
            <span aria-hidden="true">·</span>
          )}
          {publishedDate && <span>{publishedDate}</span>}
        </div>

        {/* Summary or snippet */}
        <p className="line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
          {article.summary || article.snippet || "No description available."}
        </p>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <SentimentBadge sentiment={article.sentiment} />
          {article.categories?.slice(0, 3).map((category) => (
            <CategoryBadge key={category} category={category} />
          ))}
          {article.categories && article.categories.length > 3 && (
            <span className="text-xs text-gray-400">
              +{article.categories.length - 3} more
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
