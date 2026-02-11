"use client";

import { Card } from "@/components/ui/Card";
import { BarList } from "@/components/ui/BarList";

export interface SourceData {
  name: string;
  value: number;
}

interface SourcesBarListProps {
  data: SourceData[];
}

export function SourcesBarList({ data }: Readonly<SourcesBarListProps>) {
  const hasData = data.length > 0;

  return (
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
            data={data}
            valueFormatter={(value) => `${value} artikel`}
            sortOrder="descending"
          />
        </div>
      ) : (
        <div className="mt-4 flex h-48 items-center justify-center rounded-md border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Belum ada sumber
          </p>
        </div>
      )}
    </Card>
  );
}
