import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  ClipboardList,
  History,
  ShieldAlert,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import PageContainer from "@/layouts/PageContainer";
import { AppCard } from "@/components/ui/AppCard";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import AuditStatusBadge from "@/features/audits/components/AuditStatusBadge";
import { AuditStatus } from "@/features/audits/types";
import {
  getAgentSummary,
  getMyAudits,
} from "@/features/agent-audits/api";
import type {
  AgentAuditListItem,
  AgentSummary,
} from "@/features/agent-audits/types";
import { TimeFilterChips } from "@/features/dashboard/components/TimeFilterChips";
import {
  cn,
  dateRangeFor,
  formatAuditScore,
  formatDate,
  isWithinRange,
  type DateRangePreset,
} from "@/lib/utils";

function scoreToneClass(value: number | null, fatal = false): string {
  if (fatal) return "text-danger";
  if (value === null) return "text-fg-muted";
  if (value >= 80) return "text-success";
  if (value >= 60) return "text-warning";
  return "text-danger";
}

export default function AgentDashboard() {
  const [summary, setSummary] = useState<AgentSummary | null>(null);
  const [audits, setAudits] = useState<AgentAuditListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DateRangePreset>("all");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, list] = await Promise.all([
        getAgentSummary(),
        getMyAudits(),
      ]);
      setSummary(s);
      setAudits(list);
    } catch (e) {
      console.error(e);
      setError("Could not load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Apply the time filter against `publishedAt` — published is the moment
  // an audit reaches the agent's view, so it's the most natural anchor.
  // Audits with no publishedAt (shouldn't happen for AGENT-visible rows)
  // fall back to `createdAt` so they're not silently dropped.
  const filtered = useMemo(() => {
    const r = dateRangeFor(range);
    return audits.filter((a) =>
      isWithinRange(a.publishedAt ?? a.createdAt, r),
    );
  }, [audits, range]);

  // Range-aware KPIs computed off the filtered list. The summary
  // endpoint provides the All-time numbers; we replace them whenever the
  // user picks a narrower range.
  const filteredStats = useMemo(() => {
    const total = filtered.length;
    const fatal = filtered.filter((a) => a.fatalTriggered).length;
    const reviewed = filtered.filter(
      (a) => a.status === AuditStatus.REVIEWED,
    ).length;
    const pending = filtered.filter(
      (a) => a.status === AuditStatus.PUBLISHED,
    ).length;
    const scored = filtered.filter((a) => a.finalScore !== null);
    const avg =
      scored.length > 0
        ? Math.round(
            (scored.reduce((acc, a) => acc + (a.finalScore ?? 0), 0) /
              scored.length) *
              10,
          ) / 10
        : null;
    const latest = filtered[0] ?? null;
    return { total, fatal, reviewed, pending, avg, latest };
  }, [filtered]);

  const recentAudits = useMemo(() => filtered.slice(0, 5), [filtered]);

  const pendingReviews = useMemo(
    () => filtered.filter((a) => a.status === AuditStatus.PUBLISHED).slice(0, 5),
    [filtered],
  );

  const latestFeedback = useMemo(
    () =>
      filtered.find((a) => a.status === AuditStatus.PUBLISHED) ??
      filtered[0] ??
      null,
    [filtered],
  );

  const isFiltered = range !== "all";

  return (
    <PageContainer
      maxWidth="xl"
      title="Your dashboard"
      description="Performance summary, pending reviews, and the latest feedback from your supervisors."
      actions={
        <Link
          to="/agent/audits?lens=REVIEWED"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
        >
          <History className="h-4 w-4" /> Audit history
        </Link>
      }
    >
      {/* ----- Time filter --------------------------------------------- */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <TimeFilterChips value={range} onChange={setRange} />
        <p className="text-xs text-fg-subtle">
          {loading
            ? "Loading…"
            : `${filteredStats.total} audit${filteredStats.total === 1 ? "" : "s"} in range`}
        </p>
      </div>

      {/* ----- KPI row — range-aware ----------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Average score"
          value={
            isFiltered
              ? filteredStats.avg !== null
                ? `${filteredStats.avg.toFixed(1)}%`
                : "—"
              : summary && summary.averageScore !== null
                ? `${summary.averageScore.toFixed(1)}%`
                : "—"
          }
          icon={TrendingUp}
          description={
            isFiltered ? "Within selected range" : "All published / reviewed"
          }
          loading={loading}
        />
        <StatCard
          label="Latest score"
          value={
            isFiltered
              ? filteredStats.latest && filteredStats.latest.finalScore !== null
                ? formatAuditScore(
                    filteredStats.latest.finalScore,
                    filteredStats.latest.totalScore,
                    filteredStats.latest.applicablePoints,
                  )
                : "—"
              : summary && summary.latestScore !== null
                ? `${summary.latestScore.toFixed(1)}%`
                : "—"
          }
          icon={Trophy}
          description={
            (isFiltered ? filteredStats.latest?.publishedAt : summary?.latestAuditAt)
              ? `Published ${formatDate(
                  isFiltered
                    ? filteredStats.latest!.publishedAt
                    : summary!.latestAuditAt!,
                )}`
              : "No audits in range"
          }
          loading={loading}
        />
        <StatCard
          label="Total audits"
          value={isFiltered ? filteredStats.total : (summary?.totalAudits ?? 0)}
          icon={ClipboardList}
          description={
            isFiltered
              ? `${filteredStats.reviewed} reviewed · ${filteredStats.pending} pending`
              : summary
                ? `${summary.reviewedCount} reviewed · ${summary.pendingReviewCount} pending`
                : "Published & reviewed"
          }
          loading={loading}
        />
        <StatCard
          label="Fatal triggers"
          value={isFiltered ? filteredStats.fatal : (summary?.fatalCount ?? 0)}
          icon={ShieldAlert}
          description={
            isFiltered ? "Within selected range" : "Across all your audits"
          }
          loading={loading}
        />
      </div>

      {/* ----- Pending reviews + Latest feedback ------------------------ */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <AppCard
          padding="md"
          className="lg:col-span-1"
          header={
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-warning" />
                <h3 className="text-sm font-semibold text-fg">
                  Pending reviews
                </h3>
              </div>
              {summary && summary.pendingReviewCount > 0 && (
                <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-warning">
                  {summary.pendingReviewCount}
                </span>
              )}
            </div>
          }
        >
          {loading ? (
            <p className="text-sm text-fg-subtle">Loading…</p>
          ) : pendingReviews.length === 0 ? (
            <EmptyState
              title="Nothing waiting"
              description="You're caught up. New published audits will appear here."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {pendingReviews.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/agent/audits/${a.id}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg-elevated p-3 hover:bg-bg-muted"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">
                        {a.projectNameSnapshot}
                      </p>
                      <p className="truncate text-[11px] text-fg-subtle">
                        {a.auditCode} · {formatDate(a.publishedAt)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-semibold tabular-nums",
                        scoreToneClass(a.finalScore, a.fatalTriggered),
                      )}
                    >
                      {formatAuditScore(a.finalScore, a.totalScore, a.applicablePoints)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AppCard>

        <AppCard
          padding="md"
          className="lg:col-span-2"
          header={
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-accent" />
                <h3 className="text-sm font-semibold text-fg">
                  Latest feedback
                </h3>
              </div>
              {latestFeedback && (
                <Link
                  to={`/agent/audits/${latestFeedback.id}`}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-bg-elevated px-2 text-[11px] font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
                >
                  Open
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          }
        >
          {loading ? (
            <p className="text-sm text-fg-subtle">Loading…</p>
          ) : !latestFeedback ? (
            <EmptyState
              title="No feedback yet"
              description="Once a supervisor publishes an audit, the latest comment shows up here."
            />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <AuditStatusBadge status={latestFeedback.status} />
                <span className="text-xs text-fg-subtle">
                  {latestFeedback.projectNameSnapshot} ·{" "}
                  {formatDate(latestFeedback.publishedAt)}
                </span>
              </div>
              <p
                className={cn(
                  "text-2xl font-semibold tracking-tight tabular-nums",
                  scoreToneClass(
                    latestFeedback.finalScore,
                    latestFeedback.fatalTriggered,
                  ),
                )}
              >
                {formatAuditScore(
                  latestFeedback.finalScore,
                  latestFeedback.totalScore,
                  latestFeedback.applicablePoints,
                )}
              </p>
              <p className="text-sm leading-relaxed text-fg-muted">
                Open the audit to read the parameter-by-parameter breakdown and
                supervisor remarks.
              </p>
            </div>
          )}
        </AppCard>
      </div>

      {/* ----- Recent audits ------------------------------------------- */}
      <div className="mt-6">
        <AppCard
          padding="md"
          header={
            <div className="flex w-full items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-fg">Recent audits</h3>
              <Link
                to="/agent/audits"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
              >
                See all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          }
        >
          {loading ? (
            <p className="text-sm text-fg-subtle">Loading…</p>
          ) : error ? (
            <p className="text-sm text-danger">{error}</p>
          ) : recentAudits.length === 0 ? (
            <EmptyState
              title="No audits yet"
              description="Once your supervisors publish audits, they'll appear here."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {recentAudits.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/agent/audits/${a.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-bg-elevated p-3 hover:bg-bg-muted"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">
                        {a.projectNameSnapshot}
                        <span className="ml-2 text-xs font-normal text-fg-subtle">
                          {a.auditCode}
                        </span>
                      </p>
                      <p className="truncate text-[11px] text-fg-subtle">
                        {a.callReference} · {a.supervisor.name} ·{" "}
                        {formatDate(a.publishedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <AuditStatusBadge status={a.status} />
                      <span
                        className={cn(
                          "min-w-[48px] text-right text-sm font-semibold tabular-nums",
                          scoreToneClass(a.finalScore, a.fatalTriggered),
                        )}
                      >
                        {formatAuditScore(a.finalScore, a.totalScore, a.applicablePoints)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AppCard>
      </div>
    </PageContainer>
  );
}
