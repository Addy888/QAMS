import { cn } from "@/lib/utils";

interface OpeningStatusBadgeProps {
  status?: string | null;
}

const OpeningStatusBadge = ({ status }: OpeningStatusBadgeProps) => {
  if (!status) {
    return (
      <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-bg-muted text-fg-subtle border-border">
        —
      </span>
    );
  }

  const styles: Record<string, string> = {
    "Good Opening":      "bg-success/10 text-success border-success/20",
    "Proper Greeting":   "bg-success/10 text-success border-success/20",
    "Missed Greeting":   "bg-danger/10 text-danger border-danger/20",
    "Late Pickup":       "bg-danger/10 text-danger border-danger/20",
    "Delayed Response":  "bg-warning/10 text-warning border-warning/20",
    "Dead Air":          "bg-danger/10 text-danger border-danger/20 animate-pulse",
    "Unknown":           "bg-bg-muted text-fg-subtle border-border",
  };

  const style = styles[status] ?? "bg-bg-muted text-fg-subtle border-border";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        style
      )}
    >
      {status}
    </span>
  );
};

export default OpeningStatusBadge;
