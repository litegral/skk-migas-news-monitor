"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import type { DashboardPeriod } from "@/lib/types/dashboard";
import { PERIOD_OPTIONS } from "@/lib/types/dashboard";

interface PeriodSelectorProps {
  value: DashboardPeriod;
  onChange: (value: DashboardPeriod) => void;
  className?: string;
}

export function PeriodSelector({
  value,
  onChange,
  className,
}: Readonly<PeriodSelectorProps>) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as DashboardPeriod)}>
      <SelectTrigger className={className ?? "w-[120px]"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIOD_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
