import { cn } from "@/lib/utils";

interface MetricBadgeProps {
  type: "tone" | "energy" | "listening";
  value?: string | null;
}

const MetricBadge = ({ type, value }: MetricBadgeProps) => {
  const display = value ?? "—";

  const getStyles = (): string => {
    if (!value) return "bg-bg-muted text-fg-subtle border-border";

    switch (type) {
      case "tone": {
        const map: Record<string, string> = {
          Professional:  "bg-info/10 text-info border-info/20",
          Friendly:      "bg-success/10 text-success border-success/20",
          Supportive:    "bg-success/10 text-success border-success/20",
          Aggressive:    "bg-danger/10 text-danger border-danger/20",
          Calm:          "bg-accent/10 text-accent border-accent/20",
          Rude:          "bg-danger/10 text-danger border-danger/20",
          Neutral:       "bg-bg-muted text-fg-subtle border-border",
        };
        return map[value] ?? "bg-bg-muted text-fg-subtle border-border";
      }
      case "energy": {
        const map: Record<string, string> = {
          High:   "bg-success/10 text-success border-success/20",
          Medium: "bg-warning/10 text-warning border-warning/20",
          Low:    "bg-danger/10 text-danger border-danger/20",
        };
        return map[value] ?? "bg-bg-muted text-fg-subtle border-border";
      }
      case "listening": {
        const map: Record<string, string> = {
          Excellent: "bg-success/10 text-success border-success/20",
          Good:      "bg-success/10 text-success border-success/20",
          Average:   "bg-warning/10 text-warning border-warning/20",
          Poor:      "bg-danger/10 text-danger border-danger/20",
        };
        return map[value] ?? "bg-bg-muted text-fg-subtle border-border";
      }
      default:
        return "bg-bg-muted text-fg-subtle border-border";
    }
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        getStyles()
      )}
    >
      {display}
    </span>
  );
};

export default MetricBadge;
