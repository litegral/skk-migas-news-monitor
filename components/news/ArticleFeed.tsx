"use client";

import React from "react";
import {
  RiFilterLine,
  RiCloseLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
} from "@remixicon/react";

import type { Article, Sentiment } from "@/lib/types/news";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ArticleCard } from "./ArticleCard";
import { ExportButton } from "@/components/dashboard/ExportButton";
import { cx } from "@/lib/utils";

interface ArticleFeedProps {
  articles: Article[];
  /** Map of topic ID → topic name for resolving matchedTopicIds */
  topicMap?: Record<string, string>;
  /** List of all available topic names for filtering. */
  availableTopics?: string[];
  /** Number of articles per page (default: 10). */
  pageSize?: number;
}

type SortOption = "newest" | "oldest";
type SentimentFilter = Sentiment | "all";

/** Default number of articles per page */
const DEFAULT_PAGE_SIZE = 10;

export function ArticleFeed({
  articles,
  topicMap = {},
  availableTopics = [],
  pageSize = DEFAULT_PAGE_SIZE,
}: Readonly<ArticleFeedProps>) {
  const [search, setSearch] = React.useState("");
  const [sortBy, setSortBy] = React.useState<SortOption>("newest");
  const [sentimentFilter, setSentimentFilter] =
    React.useState<SentimentFilter>("all");
  const [selectedTopics, setSelectedTopics] = React.useState<string[]>([]);
  const [showFilters, setShowFilters] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);

  // Helper: get topic names for an article
  const getTopicNames = (article: Article): string[] => {
    return article.matchedTopicIds
      ?.map((id) => topicMap[id])
      .filter((name): name is string => Boolean(name)) ?? [];
  };

  // Derive unique topics from availableTopics or from articles
  const allTopics = React.useMemo(() => {
    if (availableTopics.length > 0) return availableTopics;
    const topicSet = new Set<string>();
    articles.forEach((article) => {
      getTopicNames(article).forEach((name) => topicSet.add(name));
    });
    return Array.from(topicSet).sort();
  }, [articles, availableTopics, topicMap]);

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
      result = result.filter((article) => {
        const names = getTopicNames(article);
        return selectedTopics.every((topic) => names.includes(topic));
      });
    }

    // Sort
    result.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return sortBy === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [articles, search, sortBy, sentimentFilter, selectedTopics, topicMap]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, sortBy, sentimentFilter, selectedTopics]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredArticles.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedArticles = filteredArticles.slice(startIndex, endIndex);

  // Ensure current page is valid when filtered results change
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

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

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      // Scroll to top of article list
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Generate page numbers to display
  function getPageNumbers(): (number | "ellipsis")[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | "ellipsis")[] = [];

    // Always show first page
    pages.push(1);

    if (currentPage > 3) {
      pages.push("ellipsis");
    }

    // Show pages around current page
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push("ellipsis");
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search and filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
            <Input
              type="search"
              placeholder="Cari artikel..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
        </div>
        <div className="flex gap-2">
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
          <ExportButton articles={filteredArticles} topicMap={topicMap} />
        </div>
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
                <option value="newest">Terbaru dahulu</option>
                <option value="oldest">Terlama dahulu</option>
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
                <option value="all">Semua</option>
                <option value="positive">Positif</option>
                <option value="neutral">Netral</option>
                <option value="negative">Negatif</option>
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
                    Hapus semua
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
        Menampilkan {startIndex + 1}-{Math.min(endIndex, filteredArticles.length)} dari {filteredArticles.length} artikel
        {filteredArticles.length !== articles.length && ` (${articles.length} total)`}
      </p>

      {/* Article list */}
      <div className="flex flex-col gap-3">
        {paginatedArticles.length > 0 ? (
          paginatedArticles.map((article) => (
            <ArticleCard key={article.id ?? article.link} article={article} topicMap={topicMap} />
          ))
        ) : (
          <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-gray-300 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {articles.length === 0
                ? "Belum ada artikel. Ambil berita untuk memulai."
                : "Tidak ada artikel yang cocok dengan kriteria pencarian."}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav
          className="flex items-center justify-center gap-1"
          aria-label="Pagination"
        >
          {/* Previous button */}
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className={cx(
              "flex items-center justify-center rounded-md p-2 text-sm transition-colors",
              currentPage === 1
                ? "cursor-not-allowed text-gray-300 dark:text-gray-600"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
            )}
            aria-label="Halaman sebelumnya"
          >
            <RiArrowLeftSLine className="size-5" />
          </button>

          {/* Page numbers */}
          {getPageNumbers().map((page, index) =>
            page === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="px-2 text-gray-400 dark:text-gray-500"
              >
                ...
              </span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => goToPage(page)}
                className={cx(
                  "flex size-9 items-center justify-center rounded-md text-sm font-medium transition-colors",
                  currentPage === page
                    ? "bg-blue-600 text-white dark:bg-blue-500"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
                )}
                aria-label={`Halaman ${page}`}
                aria-current={currentPage === page ? "page" : undefined}
              >
                {page}
              </button>
            ),
          )}

          {/* Next button */}
          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={cx(
              "flex items-center justify-center rounded-md p-2 text-sm transition-colors",
              currentPage === totalPages
                ? "cursor-not-allowed text-gray-300 dark:text-gray-600"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
            )}
            aria-label="Halaman berikutnya"
          >
            <RiArrowRightSLine className="size-5" />
          </button>
        </nav>
      )}
    </div>
  );
}
