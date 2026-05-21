import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string | null | undefined;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const normalized = (status ?? "Pending").trim();

  const styles: Record<string, string> = {
    Uploading:              "bg-accent/10 text-accent border-accent/20 animate-pulse",
    "Processing Audio":     "bg-info/10 text-info border-info/20 animate-pulse",
    "Generating Transcript": "bg-info/10 text-info border-info/20 animate-pulse",
    Transcribing:           "bg-info/10 text-info border-info/20 animate-pulse",
    "Detecting Language":    "bg-info/10 text-info border-info/20 animate-pulse",
    "Running AI Analysis":   "bg-info/10 text-info border-info/20 animate-pulse",
    "Saving Results":        "bg-success/10 text-success border-success/20 animate-pulse",
    Completed:              "bg-success/10 text-success border-success/20",
    Failed:                 "bg-danger/10 text-danger border-danger/20",
    Timeout:                "bg-danger/10 text-danger border-danger/20",
    // Keep temporary/fallback backward compatibility mapping
    Pending:                "bg-warning/10 text-warning border-warning/20",
    Processing:             "bg-info/10 text-info border-info/20",
    Retrying:               "bg-warning/10 text-warning border-warning/20 animate-pulse",
  };

  const style = styles[normalized] ?? "bg-bg-muted text-fg-subtle border-border";
  const label = normalized;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap shadow-sm",
        style
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current")} />
      {label}
    </span>
  );
};

export default StatusBadge;
