import type {
  AuditDetailResponse,
  AuditListItem,
} from "../audits/types";

/**
 * Public-safe shape returned to AGENT-only endpoints.
 *
 * Re-exported from the supervisor types so the wire format stays
 * consistent — the agent UI is just a different view of the same audit
 * row, not a different model.
 */
export type AgentAuditListItem = AuditListItem;
export type AgentAuditDetail = AuditDetailResponse;

/**
 * Compact dashboard summary returned by `GET /agent/summary`.
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
