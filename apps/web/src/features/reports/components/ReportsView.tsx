import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  ClipboardList,
  RefreshCw,
  ShieldAlert,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import PageContainer from "@/layouts/PageContainer";
import { AppCard } from "@/components/ui/AppCard";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { TimeFilterChips } from "@/features/dashboard/components/TimeFilterChips";
import { listAudits } from "@/features/audits/api";
import {
  AuditStatus,
  type AuditListItem,
} from "@/features/audits/types";
import {
  cn,
  dateRangeFor,
  isWithinRange,
  qualityLabel,
  type DateRangePreset,
  type QualityLabel,
} from "@/lib/utils";

interface AggRow {
  key: string;
  label: string;
  sublabel?: string;
  total: number;
  scored: number;
  averageScore: number | null;
  fatalCount: number;
  good: number;
  average: number;
  bad: number;
  pending: number;
  reviewed: number;
}

function emptyAgg(key: string, label: string, sublabel?: string): AggRow {
  return {
    key,
    label,
    sublabel,
    total: 0,
    scored: 0,
    averageScore: null,
    fatalCount: 0,
    good: 0,
    average: 0,
    bad: 0,
    pending: 0,
    reviewed: 0,
  };
}

interface ReportsViewProps {
  /**
   * Title shown at the top of the page. The reports view itself is
   * unaware of who's looking — supervisor scoping is enforced server-
   * side by the audit list endpoint.
   */
  title: string;
  description?: string;
  /** Pages with broader scope (admin) want a different empty-state copy. */
  scope: "supervisor" | "admin";
}

const QUALITY_TONE: Record<NonNullable<QualityLabel>, string> = {
  GOOD: "border-success/40 bg-success/15 text-success",
  AVERAGE: "border-warning/40 bg-warning/15 text-warning",
  BAD: "border-danger/40 bg-danger/15 text-danger",
};

/**
 * Real-data quality / performance overview. Reuses the existing audit
 * list endpoint (which is already correctly scoped per role) so this
 * page works for both supervisor and admin without a separate API.
 *
 * The single source of truth is `audits`: every KPI, breakdown, and
 * leaderboard is computed off the time-filtered slice client-side.
 */
export function ReportsView({ title, description, scope }: ReportsViewProps) {
  const [audits, setAudits] = useState<AuditListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DateRangePreset>("month");

  const fetchAudits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAudits();
      setAudits(data);
    } catch (e) {
      console.error(e);
      setError("Could not load report data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAudits();
  }, [fetchAudits]);

  const filtered = useMemo(() => {
    const r = dateRangeFor(range);
    return audits.filter((a) => isWithinRange(a.createdAt, r));
  }, [audits, range]);

  const overall = useMemo(() => {
    const total = filtered.length;
    const scored = filtered.filter((a) => a.finalScore !== null);
    const avg =
      scored.length > 0
        ? Math.round(
            (scored.reduce((acc, a) => acc + (a.finalScore ?? 0), 0) /
              scored.length) *
              10,
          ) / 10
        : null;
    const fatal = filtered.filter((a) => a.fatalTriggered).length;
    const published = filtered.filter(
      (a) =>
        a.status === AuditStatus.PUBLISHED ||
        a.status === AuditStatus.REVIEWED,
    ).length;
    const reviewed = filtered.filter(
      (a) => a.status === AuditStatus.REVIEWED,
    ).length;
    const submitted = filtered.filter(
      (a) => a.status === AuditStatus.SUBMITTED,
    ).length;
    const inProgress = filtered.filter(
      (a) =>
        a.status === AuditStatus.DRAFT ||
        a.status === AuditStatus.IN_PROGRESS,
    ).length;

    let good = 0;
    let average = 0;
    let bad = 0;
    for (const a of filtered) {
      const q = qualityLabel(a.finalScore, a.fatalTriggered);
      if (q === "GOOD") good += 1;
      else if (q === "AVERAGE") average += 1;
      else if (q === "BAD") bad += 1;
    }

    return {
      total,
      avg,
      fatal,
      published,
      reviewed,
      submitted,
      inProgress,
      good,
      average,
      bad,
    };
  }, [filtered]);

  /** Aggregate by a row's `keyOf(row)` — used to build agent / project tables. */
  function aggregate(
    keyOf: (row: AuditListItem) => { key: string; label: string; sublabel?: string },
  ): AggRow[] {
    const map = new Map<string, AggRow>();
    for (const a of filtered) {
      const { key, label, sublabel } = keyOf(a);
      const row = map.get(key) ?? emptyAgg(key, label, sublabel);
      row.total += 1;
      if (a.finalScore !== null) {
        row.scored += 1;
        // running mean
        row.averageScore =
          row.averageScore === null
            ? a.finalScore
            : row.averageScore + (a.finalScore - row.averageScore) / row.scored;
      }
      if (a.fatalTriggered) row.fatalCount += 1;
      if (a.status === AuditStatus.PUBLISHED) row.pending += 1;
      if (a.status === AuditStatus.REVIEWED) row.reviewed += 1;
      const q = qualityLabel(a.finalScore, a.fatalTriggered);
      if (q === "GOOD") row.good += 1;
      else if (q === "AVERAGE") row.average += 1;
      else if (q === "BAD") row.bad += 1;
      map.set(key, row);
    }
    return Array.from(map.values()).sort((a, b) => {
      // Sort by average score desc, then by total audits desc.
      const aa = a.averageScore ?? -1;
      const bb = b.averageScore ?? -1;
      if (bb !== aa) return bb - aa;
      return b.total - a.total;
    });
  }

  const byAgent = useMemo(
    () =>
      aggregate((a) => ({
        key: a.agent.id,
        label: a.agent.name,
        sublabel: `@${a.agent.username}`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered],
  );

  const byProject = useMemo(
    () =>
      aggregate((a) => ({
        key: `${a.projectNameSnapshot}::${a.groupNameSnapshot}`,
        label: a.projectNameSnapshot,
        sublabel: a.groupNameSnapshot,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered],
  );

  const topPerformers = useMemo(
    () =>
      [...byAgent]
        .filter((r) => r.scored >= 1)
        .sort((a, b) => (b.averageScore ?? -1) - (a.averageScore ?? -1))
        .slice(0, 5),
    [byAgent],
  );

  const bottomPerformers = useMemo(
    () =>
      [...byAgent]
        .filter((r) => r.scored >= 1)
        .sort((a, b) => (a.averageScore ?? Infinity) - (b.averageScore ?? Infinity))
        .slice(0, 5),
    [byAgent],
  );

  return (
    <PageContainer
      maxWidth="xl"
      title={title}
      description={
        description ??
        (scope === "admin"
          ? "Workspace-wide quality, performance and pipeline metrics."
          : "Quality and performance for your scope of audits.")
      }
      actions={
        <button
          onClick={() => void fetchAudits()}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <TimeFilterChips value={range} onChange={setRange} />
        <p className="text-xs text-fg-subtle">
          {loading
            ? "Loading…"
            : `${overall.total} audit${overall.total === 1 ? "" : "s"} in range`}
        </p>
      </div>

      {/* Overall quality KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Audits in range"
          value={loading ? "—" : overall.total}
          icon={ClipboardList}
          loading={loading}
        />
        <StatCard
          label="Average score"
          value={
            loading
              ? "—"
              : overall.avg === null
                ? "—"
                : `${overall.avg.toFixed(1)}%`
          }
          icon={Star}
          description="Across published + reviewed"
          loading={loading}
        />
        <StatCard
          label="Fatal triggers"
          value={loading ? "—" : overall.fatal}
          icon={ShieldAlert}
          description="Audits with at least one fatal hit"
          loading={loading}
        />
        <StatCard
          label="Pending review"
          value={
            loading
              ? "—"
              : filtered.filter((a) => a.status === AuditStatus.PUBLISHED).length
          }
          icon={ClipboardCheck}
          description={`${overall.reviewed} reviewed by agents`}
          loading={loading}
        />
      </div>

      {/* Quality distribution + funnel */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <AppCard
          header={
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-fg">
                Quality distribution
              </h3>
              <p className="text-xs text-fg-subtle">
                GOOD ≥ 80, AVERAGE 50–79, BAD &lt; 50 (or fatal-triggered)
              </p>
            </div>
          }
        >
          <QualityBars
            good={overall.good}
            average={overall.average}
            bad={overall.bad}
            total={overall.total}
          />
        </AppCard>

        <AppCard
          header={
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-fg">
                Audit funnel
              </h3>
              <p className="text-xs text-fg-subtle">By current status</p>
            </div>
          }
          className="lg:col-span-2"
        >
          <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <FunnelTile label="In progress" value={overall.inProgress} tone="info" />
            <FunnelTile
              label="Submitted"
              value={overall.submitted}
              tone="accent"
            />
            <FunnelTile
              label="Published"
              value={overall.published - overall.reviewed}
              tone="success"
            />
            <FunnelTile label="Reviewed" value={overall.reviewed} tone="success" />
          </ul>
        </AppCard>
      </div>

      {/* Top / bottom performers */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <PerformersCard
          title="Top performers"
          icon={TrendingUp}
          tone="success"
          rows={topPerformers}
          empty="Not enough scored audits yet."
        />
        <PerformersCard
          title="Needs attention"
          icon={TrendingDown}
          tone="danger"
          rows={bottomPerformers}
          empty="Not enough scored audits yet."
        />
      </div>

      {/* Agent breakdown */}
      <div className="mt-5">
        <AppCard
          padding="none"
          header={
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-fg">
                Agent breakdown
              </h3>
              <p className="text-xs text-fg-subtle">
                Quality and pipeline split by agent
              </p>
            </div>
          }
        >
          <BreakdownTable
            rows={byAgent}
            loading={loading}
            firstColumnLabel="Agent"
            firstColumnIcon={Users}
            empty={
              error ?? (scope === "admin"
                ? "No agent activity in this range."
                : "No audits for your agents in this range.")
            }
          />
        </AppCard>
      </div>

      {/* Project breakdown */}
      <div className="mt-5">
        <AppCard
          padding="none"
          header={
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-fg">
                Project breakdown
              </h3>
              <p className="text-xs text-fg-subtle">
                Quality and pipeline split by project
              </p>
            </div>
          }
        >
          <BreakdownTable
            rows={byProject}
            loading={loading}
            firstColumnLabel="Project"
            firstColumnIcon={ClipboardList}
            empty={error ?? "No project activity in this range."}
          />
        </AppCard>
      </div>
    </PageContainer>
  );
}

function QualityBars({
  good,
  average,
  bad,
  total,
}: {
  good: number;
  average: number;
  bad: number;
  total: number;
}) {
  if (total === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No data in this range"
        description="Pick a wider time window to see the quality split."
        className="border-none bg-transparent"
      />
    );
  }
  const pct = (n: number) => Math.round((n / total) * 100);
  const rows: { label: NonNullable<QualityLabel>; count: number; tone: string }[] = [
    {
      label: "GOOD",
      count: good,
      tone: "bg-success/30 text-success",
    },
    {
      label: "AVERAGE",
      count: average,
      tone: "bg-warning/30 text-warning",
    },
    { label: "BAD", count: bad, tone: "bg-danger/30 text-danger" },
  ];
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-20 text-xs font-medium uppercase tracking-wide text-fg-muted">
            {r.label}
          </span>
          <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-bg-elevated">
            <div
              className={cn("h-full rounded-full", r.tone)}
              style={{ width: `${pct(r.count)}%` }}
            />
          </div>
          <span className="w-20 text-right text-xs tabular-nums text-fg-muted">
            {r.count} ({pct(r.count)}%)
          </span>
        </div>
      ))}
    </div>
  );
}

function FunnelTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "info" | "accent" | "success";
}) {
  const toneClass =
    tone === "info"
      ? "border-info/30 bg-info/10 text-info"
      : tone === "accent"
        ? "border-accent/30 bg-accent/10 text-accent"
        : "border-success/30 bg-success/10 text-success";
  return (
    <li
      className={cn(
        "flex flex-col rounded-md border bg-bg-elevated px-3 py-2",
        toneClass,
      )}
    >
      <span className="text-[11px] font-medium uppercase tracking-wider opacity-80">
        {label}
      </span>
      <span className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-fg">
        {value}
      </span>
    </li>
  );
}

function PerformersCard({
  title,
  icon: Icon,
  tone,
  rows,
  empty,
}: {
  title: string;
  icon: typeof TrendingUp;
  tone: "success" | "danger";
  rows: AggRow[];
  empty: string;
}) {
  const toneClass =
    tone === "success" ? "text-success" : "text-danger";
  return (
    <AppCard
      header={
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", toneClass)} />
          <h3 className="text-sm font-semibold tracking-tight text-fg">
            {title}
          </h3>
        </div>
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          title="—"
          description={empty}
          className="border-none bg-transparent"
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <li
              key={r.key}
              className="flex items-center gap-3 rounded-md border border-border bg-bg-elevated px-3 py-1.5"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-bg-muted text-[11px] font-semibold tabular-nums text-fg-muted">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{r.label}</p>
                <p className="truncate text-[11px] text-fg-subtle">
                  {r.sublabel ?? `${r.total} audits`}
                </p>
              </div>
              <span className={cn("text-sm font-semibold tabular-nums", toneClass)}>
                {r.averageScore === null ? "—" : `${r.averageScore.toFixed(1)}%`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </AppCard>
  );
}

function BreakdownTable({
  rows,
  loading,
  firstColumnLabel,
  firstColumnIcon: Icon,
  empty,
}: {
  rows: AggRow[];
  loading: boolean;
  firstColumnLabel: string;
  firstColumnIcon: typeof Users;
  empty: string;
}) {
  const columns: DataTableColumn<AggRow>[] = useMemo(
    () => [
      {
        key: "label",
        header: firstColumnLabel,
        cell: (r) => (
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-bg-muted text-fg-muted">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{r.label}</p>
              {r.sublabel && (
                <p className="truncate text-[11px] text-fg-subtle">{r.sublabel}</p>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "total",
        header: "Audits",
        align: "right",
        numeric: true,
        cell: (r) => <span className="tabular-nums text-sm text-fg">{r.total}</span>,
      },
      {
        key: "avg",
        header: "Avg",
        align: "right",
        numeric: true,
        cell: (r) => (
          <span className="text-sm font-semibold tabular-nums text-fg">
            {r.averageScore === null ? "—" : `${r.averageScore.toFixed(1)}%`}
          </span>
        ),
      },
      {
        key: "quality",
        header: "Quality split",
        cell: (r) => (
          <div className="flex items-center gap-1.5">
            <QualityChip count={r.good} tone="GOOD" />
            <QualityChip count={r.average} tone="AVERAGE" />
            <QualityChip count={r.bad} tone="BAD" />
          </div>
        ),
      },
      {
        key: "fatal",
        header: "Fatal",
        align: "right",
        numeric: true,
        cell: (r) => (
          <span
            className={cn(
              "tabular-nums text-sm",
              r.fatalCount > 0 ? "text-danger" : "text-fg-muted",
            )}
          >
            {r.fatalCount}
          </span>
        ),
      },
      {
        key: "pipe",
        header: "Pending / Reviewed",
        align: "right",
        cell: (r) => (
          <span className="whitespace-nowrap text-xs text-fg-subtle">
            {r.pending} / {r.reviewed}
          </span>
        ),
      },
    ],
    [firstColumnLabel, Icon],
  );

  return (
    <DataTable<AggRow>
      columns={columns}
      data={rows}
      rowKey={(r) => r.key}
      loading={loading}
      loadingRows={5}
      emptyState={
        <EmptyState
          icon={Icon}
          title="No data"
          description={empty}
          className="border-none bg-transparent"
        />
      }
    />
  );
}

function QualityChip({
  count,
  tone,
}: {
  count: number;
  tone: NonNullable<QualityLabel>;
}) {
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        QUALITY_TONE[tone],
      )}
    >
      {tone} · {count}
    </span>
  );
}

export default ReportsView;
