import { cn } from "@/lib/utils";
import type { DateRangePreset } from "@/lib/utils";

interface TimeFilterChipsProps {
  value: DateRangePreset;
  onChange: (next: DateRangePreset) => void;
  /** When true, also expose the "Custom" preset (which the parent owns) */
  withCustom?: boolean;
  className?: string;
}

const BUILT_IN: { label: string; value: DateRangePreset }[] = [
  { label: "All time", value: "all" },
  { label: "Today", value: "today" },
  { label: "This week", value: "week" },
  { label: "This month", value: "month" },
];

/**
 * Compact filter chip row used at the top of the supervisor and admin
 * dashboards. The parent owns the active preset and reacts to changes
 * by recomputing KPI / list data — this component is presentational
 * only so it stays trivial to reuse.
 */
export function TimeFilterChips({
  value,
  onChange,
  withCustom = false,
  className,
}: TimeFilterChipsProps) {
  const presets = withCustom
    ? [...BUILT_IN, { label: "Custom", value: "custom" as DateRangePreset }]
    : BUILT_IN;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-bg-elevated p-1",
        className,
      )}
      role="tablist"
      aria-label="Time range"
    >
      {presets.map((p) => {
        const active = value === p.value;
        return (
          <button
            key={p.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(p.value)}
            className={cn(
              "inline-flex h-7 items-center rounded px-2.5 text-xs font-medium transition-colors",
              active
                ? "bg-accent/20 text-accent"
                : "text-fg-muted hover:bg-bg-muted hover:text-fg",
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

export default TimeFilterChips;
