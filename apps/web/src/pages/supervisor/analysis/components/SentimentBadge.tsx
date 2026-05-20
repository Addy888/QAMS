import { cn } from "@/lib/utils";

interface SentimentBadgeProps {
  sentiment: string | null | undefined;
}

const SentimentBadge = ({ sentiment }: SentimentBadgeProps) => {
  const styles: Record<string, string> = {
    Positive: "bg-success/10 text-success border-success/20",
    Neutral:  "bg-info/10 text-info border-info/20",
    Negative: "bg-danger/10 text-danger border-danger/20",
    Pending:  "bg-bg-muted text-fg-subtle border-border",
  };

  const label = sentiment ?? "—";
  const style = styles[label] ?? "bg-bg-muted text-fg-subtle border-border";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
        style
      )}
    >
      {label}
    </span>
  );
};

export default SentimentBadge;
