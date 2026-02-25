"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  RiFilterLine,
  RiCloseLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiLoader4Line
} from "@remixicon/react";

import type { Article, Sentiment } from "@/lib/types/news";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ArticleCard } from "./ArticleCard";
import { ExportButton } from "@/components/dashboard/ExportButton";
import { cx } from "@/lib/utils";
import { getFeedArticlesAction, type FeedQueryParams } from "@/app/actions/articles";

interface ArticleFeedProps {
  initialArticles: Article[];
  totalArticles: number;
  /** Map of topic ID → topic name for resolving matchedTopicIds */
  topicMap?: Record<string, string>;
  /** List of all available topic names for filtering. */
  availableTopics?: string[];
  /** Number of articles per page (default: 10). */
  pageSize?: number;
}

type SortOption = "newest" | "oldest";
type SentimentFilter = Sentiment | "all";

const DEFAULT_PAGE_SIZE = 10;

export function ArticleFeed({
  initialArticles,
  totalArticles: initialTotal,
  topicMap = {},
  availableTopics = [],
  pageSize = DEFAULT_PAGE_SIZE,
}: Readonly<ArticleFeedProps>) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [total, setTotal] = useState(initialTotal);
  const [isLoading, setIsLoading] = useState(false);

  // Derive unique topics from availableTopics
  const allTopics = useMemo(() => {
    if (availableTopics.length > 0) return availableTopics;
    return [];
  }, [availableTopics]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, sortBy, sentimentFilter, selectedTopics]);

  // Fetch data
  const loadData = useCallback(async () => {
    // Skip if it perfectly matches initial state on first render
    if (
      currentPage === 1 &&
      debouncedSearch === "" &&
      sortBy === "newest" &&
      sentimentFilter === "all" &&
      selectedTopics.length === 0 &&
      !isLoading // Don't skip if manual refresh needed
    ) {
      if (articles !== initialArticles) {
        setArticles(initialArticles);
        setTotal(initialTotal);
      }
      return;
    }

    setIsLoading(true);
    try {
      const params: FeedQueryParams = {
        page: currentPage,
        limit: pageSize,
        search: debouncedSearch,
        sentiment: sentimentFilter,
        topics: selectedTopics,
        sortBy
      };
      const res = await getFeedArticlesAction(params);
      if (!res.error) {
        setArticles(res.articles);
        setTotal(res.total);
      }
    } catch (err) {
      console.error("Failed to load articles", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, debouncedSearch, sortBy, sentimentFilter, selectedTopics, pageSize, initialArticles, initialTotal]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  const totalPages = Math.ceil(total / pageSize);

  function toggleTopic(topic: string) {
    setSelectedTopics((prev) =>
      prev.includes(topic)
        ? prev.filter((t) => t !== topic)
        : [...prev, topic]
    );
  }

  function clearTopicFilters() {
    setSelectedTopics([]);
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function getPageNumbers(): (number | "ellipsis")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const pages: (number | "ellipsis")[] = [1];

    if (currentPage > 3) pages.push("ellipsis");

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) pages.push("ellipsis");
    if (totalPages > 1) pages.push(totalPages);

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
          <ExportButton articles={articles} topicMap={topicMap} />
        </div>
      </div>

      {/* Filter options */}
      {showFilters && (
        <div className="flex flex-col gap-4 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-center gap-4">
            {/* Sort */}
            <div className="flex items-center gap-2">
              <label htmlFor="sort" className="text-sm text-gray-600 dark:text-gray-400">Sort:</label>
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
              <label htmlFor="sentiment" className="text-sm text-gray-600 dark:text-gray-400">Sentiment:</label>
              <select
                id="sentiment"
                value={sentimentFilter}
                onChange={(e) => setSentimentFilter(e.target.value as SentimentFilter)}
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
                <span className="text-sm text-gray-600 dark:text-gray-400">Topics:</span>
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
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Menampilkan {(currentPage - 1) * pageSize + (articles.length > 0 ? 1 : 0)}-{Math.min(currentPage * pageSize, total)} dari {total} artikel
        </p>
        {isLoading && <RiLoader4Line className="size-4 animate-spin text-blue-500" />}
      </div>

      {/* Article list */}
      <div className={cx("flex flex-col gap-3 transition-opacity", isLoading && "opacity-60")}>
        {articles.length > 0 ? (
          articles.map((article) => (
            <ArticleCard key={article.id ?? article.link} article={article} topicMap={topicMap} />
          ))
        ) : (
          <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-gray-300 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {total === 0
                ? "Tidak ada artikel yang cocok dengan kriteria pencarian."
                : "Belum ada artikel. Ambil berita untuk memulai."}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
            className={cx(
              "flex items-center justify-center rounded-md p-2 text-sm transition-colors",
              currentPage === 1 || isLoading
                ? "cursor-not-allowed text-gray-300 dark:text-gray-600"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            )}
            aria-label="Halaman sebelumnya"
          >
            <RiArrowLeftSLine className="size-5" />
          </button>

          {getPageNumbers().map((page, index) =>
            page === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="px-2 text-gray-400 dark:text-gray-500">...</span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => goToPage(page as number)}
                disabled={isLoading}
                className={cx(
                  "flex size-9 items-center justify-center rounded-md text-sm font-medium transition-colors",
                  currentPage === page
                    ? "bg-blue-600 text-white dark:bg-blue-500"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
                  isLoading && "cursor-not-allowed opacity-50"
                )}
                aria-label={`Halaman ${page}`}
                aria-current={currentPage === page ? "page" : undefined}
              >
                {page}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages || isLoading}
            className={cx(
              "flex items-center justify-center rounded-md p-2 text-sm transition-colors",
              currentPage === totalPages || isLoading
                ? "cursor-not-allowed text-gray-300 dark:text-gray-600"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
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
