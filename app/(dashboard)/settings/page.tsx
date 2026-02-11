import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { RSSFeedManager } from "@/components/settings/RSSFeedManager";
import { TopicManager } from "@/components/settings/TopicManager";

export const metadata: Metadata = {
  title: "Settings - SKK Migas News Monitor",
};

export default async function SettingsPage() {
  const supabase = await createClient();

  // Fetch RSS feeds
  const { data: rssFeeds } = await supabase
    .from("rss_feeds")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch topics
  const { data: topics } = await supabase
    .from("topics")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
          Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Kelola topik dan sumber RSS feed Anda.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Topics section */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            Topik
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Topik digunakan sebagai pencarian untuk RapidAPI dan untuk filter artikel RSS.
          </p>
          <div className="mt-4">
            <TopicManager topics={topics ?? []} />
          </div>
        </Card>

        {/* RSS Feeds section */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            RSS Feeds
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tambah dan kelola sumber RSS feed kustom.
          </p>
          <div className="mt-4">
            <RSSFeedManager feeds={rssFeeds ?? []} />
          </div>
        </Card>
      </div>
    </>
  );
}
