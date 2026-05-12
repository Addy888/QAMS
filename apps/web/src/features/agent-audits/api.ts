import { api } from "@/services/api";
import type {
  AgentAuditDetail,
  AgentAuditListItem,
  AgentSummary,
} from "./types";

/**
 * List the current agent's visible audits (PUBLISHED + REVIEWED).
 * The backend always scopes to the JWT-resolved user — there is no
 * agentId param to pass, by design.
 */
export async function getMyAudits(): Promise<AgentAuditListItem[]> {
  const res = await api.get<AgentAuditListItem[]>("/agent/audits");
  return res.data;
}

export async function getMyAuditById(id: number): Promise<AgentAuditDetail> {
  const res = await api.get<AgentAuditDetail>(`/agent/audits/${id}`);
  return res.data;
}

/** Agent's stance on the published audit. */
export type AckMode = "AGREED" | "DISAGREED";

export interface AcknowledgePayload {
  mode: AckMode;
  /**
   * Required when `mode === "DISAGREED"`. Stored as the agent's reason
   * for disputing the supervisor's call. Optional otherwise.
   */
  remark?: string;
}

/**
 * Acknowledge an audit. Agent picks Agree / Disagree; the backend
 * persists `acknowledgmentMode` + `acknowledgmentRemark` and moves
 * the audit PUBLISHED → REVIEWED. Score and answers are never mutated.
 */
export async function acknowledgeAudit(
  id: number,
  payload: AcknowledgePayload,
): Promise<AgentAuditDetail> {
  const res = await api.patch<AgentAuditDetail>(
    `/agent/audits/${id}/review`,
    payload,
  );
  return res.data;
}

export async function getAgentSummary(): Promise<AgentSummary> {
  const res = await api.get<AgentSummary>("/agent/summary");
  return res.data;
}
