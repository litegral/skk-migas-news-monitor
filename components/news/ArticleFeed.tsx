"use client";

import React from "react";
import { RiFilterLine, RiCloseLine } from "@remixicon/react";

import type { Article, Sentiment } from "@/lib/types/news";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ArticleCard } from "./ArticleCard";
import { cx } from "@/lib/utils";

interface ArticleFeedProps {
  articles: Article[];
  /** List of all available topics for filtering. */
  availableTopics?: string[];
}

type SortOption = "newest" | "oldest";
type SentimentFilter = Sentiment | "all";

export function ArticleFeed({ articles, availableTopics = [] }: Readonly<ArticleFeedProps>) {
  const [search, setSearch] = React.useState("");
  const [sortBy, setSortBy] = React.useState<SortOption>("newest");
  const [sentimentFilter, setSentimentFilter] =
    React.useState<SentimentFilter>("all");
  const [selectedTopics, setSelectedTopics] = React.useState<string[]>([]);
  const [showFilters, setShowFilters] = React.useState(false);

  // Derive unique topics from articles if not provided
  const allTopics = React.useMemo(() => {
    if (availableTopics.length > 0) return availableTopics;
    const topicSet = new Set<string>();
    articles.forEach((article) => {
      article.matchedTopics?.forEach((topic) => topicSet.add(topic));
    });
    return Array.from(topicSet).sort();
  }, [articles, availableTopics]);

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

    // Topic filter (article must match ALL selected topics)
    if (selectedTopics.length > 0) {
      result = result.filter((article) =>
        selectedTopics.every((topic) =>
          article.matchedTopics?.includes(topic),
        ),
      );
    }

    // Sort
    result.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return sortBy === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [articles, search, sortBy, sentimentFilter, selectedTopics]);

  function toggleTopic(topic: string) {
    setSelectedTopics((prev) =>
      prev.includes(topic)
        ? prev.filter((t) => t !== topic)
        : [...prev, topic],
    );
  }

  function clearTopicFilters() {
    setSelectedTopics([]);
  }

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
          {(sentimentFilter !== "all" || selectedTopics.length > 0) && (
            <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              {(sentimentFilter !== "all" ? 1 : 0) + selectedTopics.length}
            </span>
          )}
        </Button>
      </div>

      {/* Filter options */}
      {showFilters && (
        <div className="flex flex-col gap-4 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-center gap-4">
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

          {/* Topic filter */}
          {allTopics.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Topics:
                </span>
                {selectedTopics.length > 0 && (
                  <button
                    type="button"
                    onClick={clearTopicFilters}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {allTopics.map((topic) => {
                  const isSelected = selectedTopics.includes(topic);
                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => toggleTopic(topic)}
                      className={cx(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                        isSelected
                          ? "bg-blue-600 text-white dark:bg-blue-500"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600",
                      )}
                    >
                      {topic}
                      {isSelected && <RiCloseLine className="size-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
