import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

import type { DashboardPeriod } from "@/lib/types/dashboard";
import { DEFAULT_PERIOD, PERIOD_OPTIONS } from "@/lib/types/dashboard";
import { getActiveTopics, getPaginatedArticles } from "@/lib/services/dashboard";

import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { DashboardWidgets } from "@/components/dashboard/ServerWidgets";

export const metadata: Metadata = {
  title: "Dashboard - SKK Migas Kalsul News Monitor",
};

export default async function DashboardPage(
  props: {
    searchParams?: Promise<{ period?: string }>;
  }
) {
  const searchParams = await props.searchParams;

  // Parse period from searchParams or default
  let period: DashboardPeriod = DEFAULT_PERIOD;
  if (searchParams?.period && PERIOD_OPTIONS.some(o => o.value === searchParams.period)) {
    period = searchParams.period as DashboardPeriod;
  }

  // Fetch base layout data (topics, active flags, etc.)
  const { topicMap, availableTopics } = await getActiveTopics();

  // Fetch initial articles for the feed (page 1)
  const { articles: initialArticles, total: totalArticles } = await getPaginatedArticles(1, 10);

  // We need pendingCount for the SyncButton logic. 
  // It's fetched lightly. We can just do a very quick count query.
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let pendingCount = 0;
  let failedCount = 0;
  let decodePendingCount = 0;

  if (userId) {
    const [pendingRes, failedRes, decodePendingRes] = await Promise.all([
      supabase
        .from("articles")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", userId)
        .eq("ai_processed", false)
        .eq("url_decoded", true)
        .eq("decode_failed", false),
      supabase
        .from("articles")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", userId)
        .eq("ai_processed", true)
        .not("ai_error", "is", null),
      supabase
        .from("articles")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", userId)
        .eq("url_decoded", false)
    ]);

    pendingCount = pendingRes.count ?? 0;
    failedCount = failedRes.count ?? 0;
    decodePendingCount = decodePendingRes.count ?? 0;
  }

  // Pre-render the Suspense-wrapped Server Widgets
  const widgets = DashboardWidgets({ period });

  return (
    <DashboardClient
      widgets={widgets}
      period={period}
      topicMap={topicMap}
      availableTopics={availableTopics}
      failedCount={failedCount}
      pendingCount={pendingCount}
      decodePendingCount={decodePendingCount}
      initialArticles={initialArticles}
      totalArticles={totalArticles}
    />
  );
}
