"use client";

import React from "react";
import { RiFilterLine } from "@remixicon/react";

import type { Article, Sentiment } from "@/lib/types/news";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ArticleCard } from "./ArticleCard";

interface ArticleFeedProps {
  articles: Article[];
}

type SortOption = "newest" | "oldest";
type SentimentFilter = Sentiment | "all";

export function ArticleFeed({ articles }: Readonly<ArticleFeedProps>) {
  const [search, setSearch] = React.useState("");
  const [sortBy, setSortBy] = React.useState<SortOption>("newest");
  const [sentimentFilter, setSentimentFilter] =
    React.useState<SentimentFilter>("all");
  const [showFilters, setShowFilters] = React.useState(false);

  // Filter and sort articles
  const filteredArticles = React.useMemo(() => {
    let result = [...articles];

    // Search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (article) =>
          article.title.toLowerCase().includes(searchLower) ||
          article.snippet?.toLowerCase().includes(searchLower) ||
          article.summary?.toLowerCase().includes(searchLower) ||
          article.sourceName?.toLowerCase().includes(searchLower),
      );
    }

    // Sentiment filter
    if (sentimentFilter !== "all") {
      result = result.filter(
        (article) => article.sentiment === sentimentFilter,
      );
    }

    // Sort
    result.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return sortBy === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [articles, search, sortBy, sentimentFilter]);

  return (
    <div className="flex flex-col gap-4">
      {/* Search and filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Input
            type="search"
            placeholder="Search articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
        </div>
        <Button
          variant="secondary"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <RiFilterLine className="size-4" />
          Filters
        </Button>
      </div>

      {/* Filter options */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-4 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
          {/* Sort */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="sort"
              className="text-sm text-gray-600 dark:text-gray-400"
            >
              Sort:
            </label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          {/* Sentiment filter */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="sentiment"
              className="text-sm text-gray-600 dark:text-gray-400"
            >
              Sentiment:
            </label>
            <select
              id="sentiment"
              value={sentimentFilter}
              onChange={(e) =>
                setSentimentFilter(e.target.value as SentimentFilter)
              }
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <option value="all">All</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>
        </div>
      )}

      {/* Results count */}
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Showing {filteredArticles.length} of {articles.length} articles
      </p>

      {/* Article list */}
      <div className="flex flex-col gap-3">
        {filteredArticles.length > 0 ? (
          filteredArticles.map((article) => (
            <ArticleCard key={article.id ?? article.link} article={article} />
          ))
        ) : (
          <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-gray-300 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {articles.length === 0
                ? "No articles yet. Fetch news to get started."
                : "No articles match your search criteria."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
