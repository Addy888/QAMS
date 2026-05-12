/**
 * Frontend mirror of `apps/api/src/agent-audits/types.ts`. The agent's
 * list and detail views reuse the existing supervisor-side audit types
 * — same wire shape, different consumer.
 */
export type {
  AuditDetail as AgentAuditDetail,
  AuditListItem as AgentAuditListItem,
  AuditQuestion as AgentAuditQuestion,
  AuditSection as AgentAuditSection,
  AuditAnswer as AgentAuditAnswer,
  AuditUserRef,
  AuditProjectRef,
} from "@/features/audits/types";

/**
 * Lightweight dashboard counters returned by `GET /agent/summary`.
 */
export interface AgentSummary {
  totalAudits: number;
  publishedCount: number;
  reviewedCount: number;
  pendingReviewCount: number;
  fatalCount: number;
  averageScore: number | null;
  latestScore: number | null;
  latestAuditAt: string | null;
}
