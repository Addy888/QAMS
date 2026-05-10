import { useMemo } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { cn, qualityLabel } from "@/lib/utils";
import { AuditQuestionType, type AuditDetail, type AuditQuestion } from "../types";
import type { AnswerDraftMap } from "./ScoreCardFiller";

interface LiveScorePanelProps {
  audit: AuditDetail;
  answers: AnswerDraftMap;
}

interface SectionPreview {
  id: number;
  title: string;
  pointsEarned: number;
  pointsPossible: number;
  /** Section completion as %. Display-only — independent of overall total. */
  percent: number | null;
  answered: number;
  total: number;
  fatal: boolean;
}

interface AuditPreview {
  /** Sum of weights for passing parameters (raw — fatal-agnostic). */
  raw: number | null;
  /** Final score: raw, but forced to 0 when any fatal parameter has not passed. */
  final: number | null;
  fatal: boolean;
  sections: SectionPreview[];
  answeredCount: number;
  totalQuestions: number;
}

/**
 * Mirror of the backend's `AuditScoreService.computeAudit` — kept in lockstep
 * so the on-screen number always matches what the server will persist.
 *
 *  - PASS  → +`weight` points
 *  - FAIL / N/A / unanswered → 0
 *  - any fatal that did not pass → final = 0 (raw stays informative)
 */
function previewScore(audit: AuditDetail, answers: AnswerDraftMap): AuditPreview {
  let total = 0;
  let fatalTriggered = false;
  let answeredCount = 0;
  let totalQuestions = 0;

  const sections: SectionPreview[] = audit.sections.map((section) => {
    let sectionEarned = 0;
    let sectionPossible = 0;
    let sectionFatal = false;
    let sectionAnswered = 0;

    for (const q of section.questions) {
      totalQuestions += 1;

      const draft = answers[q.id];
      const value = draft?.value ?? null;
      const isAnswered = value !== null && value !== "";
      if (isAnswered) sectionAnswered += 1;

      if (!q.scoring) continue;

      const passed = isAnswered && isPass(q, value);
      const earned = passed ? q.weight : 0;

      // Fatal flag triggers as soon as a fatal question has an
      // *answered* non-pass value. Unanswered fatals do not flip the
      // flag yet — they should fail submission, not preview as fatal.
      const fatalMiss = q.fatal && isAnswered && !passed;
      if (fatalMiss) {
        fatalTriggered = true;
        sectionFatal = true;
      }

      sectionEarned += earned;
      sectionPossible += q.weight;
      total += earned;
    }

    answeredCount += sectionAnswered;

    const percent =
      sectionPossible > 0
        ? Math.round((sectionEarned / sectionPossible) * 1000) / 10
        : null;

    return {
      id: section.id,
      title: section.title,
      pointsEarned: sectionEarned,
      pointsPossible: sectionPossible,
      percent,
      answered: sectionAnswered,
      total: section.questions.length,
      fatal: sectionFatal,
    };
  });

  // Raw is whatever has been earned so far — show it from the very first
  // answered question, even if no fatal questions are answered yet.
  const raw = answeredCount === 0 ? null : Math.round(total * 10) / 10;
  const final = raw === null ? null : fatalTriggered ? 0 : raw;

  return {
    raw,
    final,
    fatal: fatalTriggered,
    sections,
    answeredCount,
    totalQuestions,
  };
}

function isPass(q: AuditQuestion, raw: string | null): boolean {
  if (raw === null || raw === undefined || raw === "") return false;

  switch (q.type) {
    case AuditQuestionType.YES_NO:
      return raw.toLowerCase() === "yes";

    case AuditQuestionType.RATING: {
      const options = q.options ?? [];
      if (!options.length) return false;
      const max = Math.max(...options.map((o) => o.score));
      const n = Number(raw);
      if (!Number.isFinite(n)) return false;
      return n >= max;
    }

    case AuditQuestionType.MULTIPLE_CHOICE: {
      const options = q.options ?? [];
      const match = options.find(
        (o) => o.label.trim().toLowerCase() === raw.trim().toLowerCase(),
      );
      if (!match) return false;
      const max = Math.max(...options.map((o) => o.score));
      if (max <= 0) return false;
      return match.score >= max;
    }

    default:
      return false;
  }
}

const QUALITY_TONE: Record<"GOOD" | "AVERAGE" | "BAD", string> = {
  GOOD: "border-success/40 bg-success/15 text-success",
  AVERAGE: "border-warning/40 bg-warning/15 text-warning",
  BAD: "border-danger/40 bg-danger/15 text-danger",
};

export function LiveScorePanel({ audit, answers }: LiveScorePanelProps) {
  const preview = useMemo(() => previewScore(audit, answers), [audit, answers]);

  const rawLabel =
    preview.raw === null ? "—" : `${preview.raw.toFixed(1)} / 100`;
  const finalLabel =
    preview.final === null ? "—" : `${preview.final.toFixed(1)} / 100`;

  // Operational quality label is a UI hint based on the *final* score.
  // Fatal triggers always read as BAD.
  const quality = qualityLabel(preview.final, preview.fatal);

  return (
    <aside className="flex flex-col gap-3 rounded-lg border border-border bg-bg-elevated p-4 shadow-elev-1">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
          Live score
        </p>

        {/* Final + fatal status (the "decision number") */}
        <div className="mt-1 flex items-baseline gap-2">
          <p
            className={cn(
              "text-3xl font-semibold tracking-tight tabular-nums",
              preview.fatal ? "text-danger" : "text-fg",
            )}
          >
            {finalLabel}
          </p>
          <span className="text-[11px] text-fg-subtle">final</span>
        </div>

        {/* Raw score is always visible so the supervisor can see how
            close they are independent of fatal status. */}
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-sm font-medium text-fg-muted tabular-nums">
            {rawLabel}
          </p>
          <span className="text-[11px] text-fg-subtle">raw</span>
        </div>

        {/* Status row: fatal badge or "all clear" hint, plus quality label */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {preview.fatal ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-danger">
              <ShieldAlert className="h-3 w-3" />
              Fatal triggered → final 0
            </span>
          ) : preview.answeredCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success">
              <ShieldCheck className="h-3 w-3" />
              No fatal hits
            </span>
          ) : null}
          {quality !== null && (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                QUALITY_TONE[quality],
              )}
            >
              Quality · {quality}
            </span>
          )}
        </div>

        <p className="mt-2 text-xs text-fg-muted">
          {preview.answeredCount}/{preview.totalQuestions} parameters answered
        </p>
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-1.5">
        {preview.sections.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-fg">{s.title}</p>
              <p className="text-[10px] text-fg-subtle">
                {s.answered}/{s.total} answered ·{" "}
                {s.pointsEarned}/{s.pointsPossible} pts
              </p>
            </div>
            <span
              className={cn(
                "text-xs font-semibold tabular-nums",
                s.fatal ? "text-danger" : "text-fg-muted",
              )}
            >
              {s.percent === null ? "—" : `${s.percent.toFixed(0)}%`}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default LiveScorePanel;
