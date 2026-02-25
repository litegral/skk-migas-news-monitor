import React, { Suspense } from "react";
import {
    getDashboardKPIs,
    getSentimentAggregations,
    getSourcesAndCategories
} from "@/lib/services/dashboard";
import type { DashboardPeriod } from "@/lib/types/dashboard";

import { KPICard } from "@/components/dashboard/KPICard";
import { SentimentChart } from "@/components/dashboard/SentimentChart";
import { SentimentPieChart } from "@/components/dashboard/SentimentPieChart";
import { SourcesBarList } from "@/components/dashboard/SourcesBarList";
import { CategoryChart } from "@/components/dashboard/CategoryChart";
import { Card } from "@/components/ui/Card";
import { cx } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function KPISkeleton() {
    return (
        <Card className="flex h-full animate-pulse flex-col justify-between p-6">
            <div className="flex items-start justify-between">
                <div className="h-5 w-24 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="size-10 rounded-full bg-gray-200 dark:bg-gray-800" />
            </div>
            <div className="mt-4 flex flex-col gap-2">
                <div className="h-8 w-16 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-800" />
            </div>
        </Card>
    );
}

function ChartSkeleton() {
    return (
        <Card className="flex h-full min-h-[300px] animate-pulse flex-col p-6">
            <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="mt-2 h-4 w-48 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="mt-6 flex-1 rounded bg-gray-100 dark:bg-gray-800/50" />
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Server Components
// ---------------------------------------------------------------------------

async function KPITotalServer({ period }: { period: DashboardPeriod }) {
    const kpis = await getDashboardKPIs(period);
    return <KPICard type="total" value={kpis.totalArticles} period={period} />;
}

async function KPIPositiveServer({ period }: { period: DashboardPeriod }) {
    const { sentimentPieData } = await getSentimentAggregations(period);
    return <KPICard type="positive" value={sentimentPieData.positive} period={period} />;
}

async function KPINegativeServer({ period }: { period: DashboardPeriod }) {
    const { sentimentPieData } = await getSentimentAggregations(period);
    return <KPICard type="negative" value={sentimentPieData.negative} period={period} />;
}

async function KPINeutralServer({ period }: { period: DashboardPeriod }) {
    const { sentimentPieData } = await getSentimentAggregations(period);
    return <KPICard type="neutral" value={sentimentPieData.neutral} period={period} />;
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
    };
}
