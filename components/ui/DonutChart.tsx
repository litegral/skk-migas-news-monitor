// Tremor Raw DonutChart [v1.0.0]

"use client";

import React from "react";
import {
  Cell,
  Label,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import {
  AvailableChartColors,
  constructCategoryColors,
  getColorClassName,
  type AvailableChartColorsKeys,
} from "@/lib/chartUtils";
import { cx } from "@/lib/utils";

// #region Tooltip

interface ChartTooltipProps {
  active: boolean | undefined;
  payload: PayloadItem[];
  valueFormatter: (value: number) => string;
}

type PayloadItem = {
  name: string;
  value: number;
  color: AvailableChartColorsKeys;
  payload: {
    name: string;
    value: number;
    color: AvailableChartColorsKeys;
  };
};

const ChartTooltip = ({
  active,
  payload,
  valueFormatter,
}: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div
        className={cx(
          "rounded-md border text-sm shadow-md",
          "border-gray-200 dark:border-gray-800",
          "bg-white dark:bg-gray-950",
        )}
      >
        <div className={cx("space-y-1 px-4 py-2")}>
          <div className="flex items-center justify-between space-x-8">
            <div className="flex items-center space-x-2">
              <span
                aria-hidden="true"
                className={cx(
                  "size-2 shrink-0 rounded-xs",
                  getColorClassName(item.payload.color, "bg"),
                )}
              />
              <p
                className={cx(
                  "text-right whitespace-nowrap",
                  "text-gray-700 dark:text-gray-300",
                )}
              >
                {item.name}
              </p>
            </div>
            <p
              className={cx(
                "text-right font-medium whitespace-nowrap tabular-nums",
                "text-gray-900 dark:text-gray-50",
              )}
            >
              {valueFormatter(item.value)}
            </p>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// #region Legend

interface LegendItemProps {
  name: string;
  color: AvailableChartColorsKeys;
  value?: string;
}

const LegendItem = ({ name, color, value }: LegendItemProps) => {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <span
          className={cx(
            "size-2 shrink-0 rounded-xs",
            getColorClassName(color, "bg"),
          )}
          aria-hidden={true}
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">{name}</span>
      </div>
      {value && (
        <span className="text-sm font-medium text-gray-900 dark:text-gray-50">
          {value}
        </span>
      )}
    </div>
  );
};

// #region DonutChart

export interface DonutChartDataItem {
  name: string;
  value: number;
}

interface DonutChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: DonutChartDataItem[];
  colors?: AvailableChartColorsKeys[];
  valueFormatter?: (value: number) => string;
  showTooltip?: boolean;
  showLegend?: boolean;
  showLabel?: boolean;
  label?: string;
  labelClassName?: string;
  innerRadius?: number;
  outerRadius?: number;
}

const DonutChart = React.forwardRef<HTMLDivElement, DonutChartProps>(
  (props, forwardedRef) => {
    const {
      data = [],
      colors = AvailableChartColors,
      valueFormatter = (value: number) => value.toString(),
      showTooltip = true,
      showLegend = true,
      showLabel = true,
      label,
      labelClassName,
      innerRadius = 60,
      outerRadius = 80,
      className,
      ...other
    } = props;

    const categories = data.map((d) => d.name);
    const categoryColors = constructCategoryColors(categories, colors);

    // Prepare data with colors
    const chartData = data.map((item) => ({
      ...item,
      color: categoryColors.get(item.name) as AvailableChartColorsKeys,
    }));

    const total = data.reduce((sum, item) => sum + item.value, 0);
    const displayLabel = label ?? total.toLocaleString("id-ID");

    return (
      <div
        ref={forwardedRef}
        className={cx("flex flex-col gap-4", className)}
        {...other}
      >
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                strokeWidth={2}
                stroke="var(--color-background, white)"
                isAnimationActive={true}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    className={cx(getColorClassName(entry.color, "fill"))}
                    fill=""
                  />
                ))}
                {showLabel && (
                  <Label
                    value={displayLabel}
                    position="center"
                    className={cx(
                      "fill-gray-900 text-xl font-semibold dark:fill-gray-50",
                      labelClassName,
                    )}
                  />
                )}
              </Pie>
              {showTooltip && (
                <Tooltip
                  wrapperStyle={{ outline: "none" }}
                  isAnimationActive={true}
                  animationDuration={100}
                  content={({ active, payload }) => (
                    <ChartTooltip
                      active={active}
                      payload={payload as PayloadItem[]}
                      valueFormatter={valueFormatter}
                    />
                  )}
                />
              )}
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>

        {showLegend && (
          <div className="flex flex-col gap-2">
            {chartData.map((item) => (
              <LegendItem
                key={item.name}
                name={item.name}
                color={item.color}
                value={valueFormatter(item.value)}
              />
            ))}
          </div>
        )}
      </div>
    );
  },
);

DonutChart.displayName = "DonutChart";

export { DonutChart };
