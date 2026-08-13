import React, { Suspense } from "react";
import {
    getKPIComparisons,
    getSentimentAggregations,
    getSourcesAndCategories,
    getTopicWatchInsights,
} from "@/lib/services/dashboard";
import type { DashboardPeriod } from "@/lib/types/dashboard";

import { KPICard } from "@/components/dashboard/KPICard";
import { SentimentChart } from "@/components/dashboard/SentimentChart";
import { SentimentPieChart } from "@/components/dashboard/SentimentPieChart";
import { SourcesBarList } from "@/components/dashboard/SourcesBarList";
import { CategoryChart } from "@/components/dashboard/CategoryChart";
import { TopicWatchPanel } from "@/components/dashboard/TopicWatchPanel";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function KPISkeleton() {
    return (
        <Card className="h-full p-4 sm:p-5" aria-label="Memuat ringkasan">
            <div className="flex items-center gap-3">
                <Skeleton className="size-10 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-7 w-16" />
                </div>
            </div>
        </Card>
    );
}

function ChartSkeleton() {
    return (
        <Card className="h-full min-h-[284px]" aria-label="Memuat visualisasi">
            <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48 max-w-full" />
            </div>
            <Skeleton className="h-48 w-full rounded-lg" />
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Server Components
// ---------------------------------------------------------------------------

async function KPITotalServer({ period }: { period: DashboardPeriod }) {
    const data = await getKPIComparisons(period);
    return <KPICard type="total" {...data.total} period={period} hasPreviousPeriod={data.hasPreviousPeriod} />;
}

async function KPIPositiveServer({ period }: { period: DashboardPeriod }) {
    const data = await getKPIComparisons(period);
    return <KPICard type="positive" {...data.positive} period={period} hasPreviousPeriod={data.hasPreviousPeriod} />;
}

async function KPINegativeServer({ period }: { period: DashboardPeriod }) {
    const data = await getKPIComparisons(period);
    return <KPICard type="negative" {...data.negative} period={period} hasPreviousPeriod={data.hasPreviousPeriod} />;
}

async function KPINeutralServer({ period }: { period: DashboardPeriod }) {
    const data = await getKPIComparisons(period);
    return <KPICard type="neutral" {...data.neutral} period={period} hasPreviousPeriod={data.hasPreviousPeriod} />;
}

async function SentimentTimelineServer({ period }: { period: DashboardPeriod }) {
    const { sentimentData } = await getSentimentAggregations(period);
    return <SentimentChart data={sentimentData} period={period} />;
}

async function SentimentPieServer({ period }: { period: DashboardPeriod }) {
    const { sentimentPieData } = await getSentimentAggregations(period);
    return <SentimentPieChart data={sentimentPieData} period={period} />;
}

async function SourcesServer({ period }: { period: DashboardPeriod }) {
    const { sourcesData, allSourcesData } = await getSourcesAndCategories(period);
    return <SourcesBarList data={sourcesData} allSourcesData={allSourcesData} />;
}

async function CategoriesServer({ period }: { period: DashboardPeriod }) {
    const { categoryData } = await getSourcesAndCategories(period);
    return <CategoryChart data={categoryData} />;
}

async function TopicWatchServer({ period }: { period: DashboardPeriod }) {
    const data = await getTopicWatchInsights(period);
    return <TopicWatchPanel data={data} period={period} />;
}

// ---------------------------------------------------------------------------
// Suspense Wrappers Export
// ---------------------------------------------------------------------------

export function DashboardWidgets({ period }: { period: DashboardPeriod }) {
    return {
        kpiTotal: (
            <Suspense fallback={<KPISkeleton />}>
                <KPITotalServer period={period} />
            </Suspense>
        ),
        kpiPositive: (
            <Suspense fallback={<KPISkeleton />}>
                <KPIPositiveServer period={period} />
            </Suspense>
        ),
        kpiNegative: (
            <Suspense fallback={<KPISkeleton />}>
                <KPINegativeServer period={period} />
            </Suspense>
        ),
        kpiNeutral: (
            <Suspense fallback={<KPISkeleton />}>
                <KPINeutralServer period={period} />
            </Suspense>
        ),
        sentimentTimeline: (
            <Suspense fallback={<ChartSkeleton />}>
                <SentimentTimelineServer period={period} />
            </Suspense>
        ),
        sentimentPie: (
            <Suspense fallback={<ChartSkeleton />}>
                <SentimentPieServer period={period} />
            </Suspense>
        ),
        sources: (
            <Suspense fallback={<ChartSkeleton />}>
                <SourcesServer period={period} />
            </Suspense>
        ),
        categories: (
            <Suspense fallback={<ChartSkeleton />}>
                <CategoriesServer period={period} />
            </Suspense>
        ),
        topicWatch: (
            <Suspense fallback={<ChartSkeleton />}>
                <TopicWatchServer period={period} />
            </Suspense>
        ),
    };
}
