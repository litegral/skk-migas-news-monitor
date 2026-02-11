import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Settings - SKK Migas News Monitor",
};

export default function SettingsPage() {
  return (
    <>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
          Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your RSS feeds and search queries.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* RSS Feeds section */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            RSS Feeds
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Add and manage custom RSS feed sources.
          </p>
          <div className="mt-4 flex h-48 items-center justify-center rounded-md border border-dashed border-gray-300 dark:border-gray-700">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              RSS feed manager will appear here
            </p>
          </div>
        </Card>

        {/* Search Queries section */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            Search Queries
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage search terms for the RapidAPI news endpoint.
          </p>
          <div className="mt-4 flex h-48 items-center justify-center rounded-md border border-dashed border-gray-300 dark:border-gray-700">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Search query manager will appear here
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
