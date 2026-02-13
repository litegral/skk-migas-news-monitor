"use client";

import React from "react";
import { Card } from "@/components/ui/Card";
import { BarList } from "@/components/ui/BarList";
import { AllSourcesModal } from "@/components/dashboard/AllSourcesModal";

export interface SourceData {
  name: string;
  value: number;
}

interface SourcesBarListProps {
  /** Top 10 sources + "Lainnya" for bar chart display */
  data: SourceData[];
  /** All sources for the modal */
  allSourcesData: SourceData[];
}

export function SourcesBarList({ data, allSourcesData }: Readonly<SourcesBarListProps>) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  // Separate "Lainnya" from top sources for display
  const topSources = data.filter((item) => item.name !== "Lainnya");
  const othersItem = data.find((item) => item.name === "Lainnya");

  const hasData = topSources.length > 0;

  return (
    <>
      <Card>
        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
          Sumber Teratas
        </h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Artikel berdasarkan sumber
        </p>

        {hasData ? (
          <div className="mt-4">
            <BarList
              data={topSources}
              valueFormatter={(value) => `${value} artikel`}
              sortOrder="descending"
            />

            {/* Link to show all sources */}
            {othersItem && othersItem.value > 0 && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="mt-3 text-xs text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                + {othersItem.value} artikel dari sumber lainnya
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 flex h-48 items-center justify-center rounded-md border border-dashed border-gray-300 dark:border-gray-700">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Belum ada sumber
            </p>
          </div>
        )}
      </Card>

      {/* All Sources Modal */}
      <AllSourcesModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        data={allSourcesData}
      />
    </>
  );
}
