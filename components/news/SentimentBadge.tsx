import type { Sentiment } from "@/lib/types/news";
import { Badge, type BadgeProps } from "@/components/ui/Badge";

interface SentimentBadgeProps extends Omit<BadgeProps, "variant"> {
  sentiment: Sentiment | null;
}

const sentimentConfig: Record<
  Sentiment,
  { variant: BadgeProps["variant"]; label: string }
> = {
  positive: { variant: "success", label: "Positif" },
  negative: { variant: "error", label: "Negatif" },
  neutral: { variant: "neutral", label: "Netral" },
};

export function SentimentBadge({
  sentiment,
  ...props
}: Readonly<SentimentBadgeProps>) {
  if (!sentiment) {
    return (
      <Badge variant="neutral" {...props}>
        Belum Dianalisis
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
