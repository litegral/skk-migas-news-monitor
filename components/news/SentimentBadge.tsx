import type { Sentiment } from "@/lib/types/news";
import { Badge, type BadgeProps } from "@/components/ui/Badge";

interface SentimentBadgeProps extends Omit<BadgeProps, "variant"> {
  sentiment: Sentiment | null;
}

const sentimentConfig: Record<
  Sentiment,
  { variant: BadgeProps["variant"]; label: string }
> = {
  positive: { variant: "success", label: "Positive" },
  negative: { variant: "error", label: "Negative" },
  neutral: { variant: "neutral", label: "Neutral" },
};

export function SentimentBadge({
  sentiment,
  ...props
}: Readonly<SentimentBadgeProps>) {
  if (!sentiment) {
    return (
      <Badge variant="neutral" {...props}>
        Unanalyzed
      </Badge>
    );
  }

  const config = sentimentConfig[sentiment];

  return (
    <Badge variant={config.variant} {...props}>
      {config.label}
    </Badge>
  );
}
