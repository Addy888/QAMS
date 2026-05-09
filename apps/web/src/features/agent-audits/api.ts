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

/**
 * Acknowledge / mark an audit as reviewed. Only valid when the audit
 * is in PUBLISHED state — calling this on a REVIEWED audit returns 400.
 */
export async function acknowledgeAudit(
  id: number,
): Promise<AgentAuditDetail> {
  const res = await api.patch<AgentAuditDetail>(
    `/agent/audits/${id}/review`,
  );
  return res.data;
}

export async function getAgentSummary(): Promise<AgentSummary> {
  const res = await api.get<AgentSummary>("/agent/summary");
  return res.data;
}
