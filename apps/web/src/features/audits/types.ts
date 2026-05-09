/**
 * Frontend mirror of the API audit types. Keeping them in lockstep with
 * `apps/api/src/audits/types.ts` so the supervisor UI stays decoupled
 * from any Prisma client.
 */

export const AuditStatus = {
  DRAFT: "DRAFT",
  IN_PROGRESS: "IN_PROGRESS",
  SUBMITTED: "SUBMITTED",
  /** Visible to the agent and immutable for everyone. */
  PUBLISHED: "PUBLISHED",
  /** Agent has acknowledged the audit. Terminal. */
  REVIEWED: "REVIEWED",
  /** Legacy — never assigned by new code, but old rows may still carry it. */
  COMPLETED: "COMPLETED",
} as const;
export type AuditStatus = (typeof AuditStatus)[keyof typeof AuditStatus];

/** Statuses the agent is allowed to see. */
export const AGENT_VISIBLE_STATUSES: AuditStatus[] = [
  AuditStatus.PUBLISHED,
  AuditStatus.REVIEWED,
];

/** Statuses in which the audit is locked / read-only for everyone. */
export const AUDIT_IMMUTABLE_STATUSES: AuditStatus[] = [
  AuditStatus.PUBLISHED,
  AuditStatus.REVIEWED,
  AuditStatus.COMPLETED,
];

export const AuditQuestionType = {
  YES_NO: "YES_NO",
  MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
  RATING: "RATING",
  FREE_TEXT: "FREE_TEXT",
} as const;
export type AuditQuestionType =
  (typeof AuditQuestionType)[keyof typeof AuditQuestionType];

export interface AuditUserRef {
  id: string;
  name: string;
  username: string;
}

export interface AuditProjectRef {
  id: number;
  projectName: string;
  groupName: string;
}

export interface AuditListItem {
  id: number;
  auditCode: string;
  status: AuditStatus;
  callReference: string;
  groupNameSnapshot: string;
  projectNameSnapshot: string;
  totalScore: number | null;
  finalScore: number | null;
  fatalTriggered: boolean;
  acknowledged: boolean;
  agent: AuditUserRef;
  supervisor: AuditUserRef;
  project: AuditProjectRef;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  publishedAt: string | null;
  reviewedAt: string | null;
  /** Legacy — null on all newly-created audits. */
  completedAt: string | null;
}

export interface AuditQuestionOption {
  label: string;
  score: number;
}

export interface AuditAnswer {
  id: number;
  questionId: number;
  value: string | null;
  normalizedScore: number | null;
  fatalHit: boolean;
  remark: string | null;
}

export interface AuditQuestion {
  id: number;
  prompt: string;
  helpText: string | null;
  type: AuditQuestionType;
  weight: number;
  scoring: boolean;
  fatal: boolean;
  compliance: boolean;
  required: boolean;
  position: number;
  options: AuditQuestionOption[] | null;
  answer: AuditAnswer | null;
}

export interface AuditSection {
  id: number;
  title: string;
  weight: number;
  position: number;
  sectionScore: number | null;
  remark: string | null;
  questions: AuditQuestion[];
}

export interface AuditDetail extends AuditListItem {
  overallComment: string | null;
  scorecardTemplateId: number | null;
  sections: AuditSection[];
}

export interface ScorecardSection {
  id: number;
  title: string;
  description: string | null;
  weight: number;
  position: number;
  questions: ScorecardQuestion[];
}

export interface ScorecardQuestion {
  id: number;
  prompt: string;
  helpText: string | null;
  type: AuditQuestionType;
  weight: number;
  scoring: boolean;
  fatal: boolean;
  compliance: boolean;
  required: boolean;
  position: number;
  optionsJson: unknown;
}

/**
 * Slim scorecard shape returned by `GET /audits/scorecards` for the
 * supervisor wizard. The full structure (sections + questions) is
 * materialized server-side onto the audit when the supervisor binds the
 * scorecard, so the wizard only needs identifying / display fields here.
 *
 * The full editor shape lives in `@/features/scorecards/types`.
 */
export interface ScorecardTemplate {
  id: number;
  name: string;
  description: string | null;
  groupName: string;
  projectId: number | null;
  /** ACTIVE / INACTIVE — supervisor list always returns ACTIVE only. */
  status: "ACTIVE" | "INACTIVE";
  version: number;
  sectionCount: number;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}
