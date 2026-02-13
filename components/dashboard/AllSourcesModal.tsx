"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogCloseButton,
} from "@/components/ui/Dialog";

export interface SourceData {
  name: string;
  value: number;
}

interface AllSourcesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: SourceData[];
}

export function AllSourcesModal({
  open,
  onOpenChange,
  data,
}: Readonly<AllSourcesModalProps>) {
  const totalArticles = data.reduce((sum, s) => sum + s.value, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-hidden">
        <DialogCloseButton />
        <DialogHeader>
          <DialogTitle>Semua Sumber</DialogTitle>
          <DialogDescription>
            {data.length} sumber dengan total {totalArticles} artikel
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-1">
            {data.map((source, index) => (
              <div
                key={source.name}
                className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-right text-xs text-gray-400 dark:text-gray-500">
                    {index + 1}.
                  </span>
                  <span className="text-sm text-gray-900 dark:text-gray-50">
                    {source.name}
                  </span>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {source.value} artikel
                </span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
