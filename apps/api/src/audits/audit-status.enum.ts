/**
 * App-side mirror of the Prisma `AuditStatus` enum so the rest of the
 * codebase (DTOs, services, types, frontend types) can stay decoupled
 * from `@prisma/client`.
 */
export const AuditStatus = {
  DRAFT: "DRAFT",
  IN_PROGRESS: "IN_PROGRESS",
  SUBMITTED: "SUBMITTED",
  /** Published — visible to the agent and immutable for everyone. */
  PUBLISHED: "PUBLISHED",
  /** Agent has acknowledged the audit. Terminal. */
  REVIEWED: "REVIEWED",
  /** Legacy — retained so old rows continue to deserialize cleanly. */
  COMPLETED: "COMPLETED",
} as const;

export type AuditStatus = (typeof AuditStatus)[keyof typeof AuditStatus];

/**
 * Allowed transitions, enforced by the service layer. Anything not in
 * this map is rejected with a 400.
 *
 * Notes:
 *  - `SUBMITTED → PUBLISHED` is the supervisor "publish" action and the
 *    point at which the audit becomes immutable.
 *  - `PUBLISHED → REVIEWED` is the agent's acknowledgement.
 *  - `REVIEWED` is terminal — nothing reopens it.
 *  - `COMPLETED` is left empty: legacy rows can be read but never
 *    transitioned. New audits never land here.
 */
export const AUDIT_STATUS_TRANSITIONS: Record<AuditStatus, AuditStatus[]> = {
  [AuditStatus.DRAFT]: [AuditStatus.IN_PROGRESS, AuditStatus.SUBMITTED],
  [AuditStatus.IN_PROGRESS]: [AuditStatus.SUBMITTED, AuditStatus.DRAFT],
  [AuditStatus.SUBMITTED]: [AuditStatus.PUBLISHED, AuditStatus.IN_PROGRESS],
  [AuditStatus.PUBLISHED]: [AuditStatus.REVIEWED],
  [AuditStatus.REVIEWED]: [],
  [AuditStatus.COMPLETED]: [],
};

/**
 * Statuses an audit can be in once it is visible to the agent. Used by
 * authorization checks in `AuditsService.getById` and the AGENT-only
 * controller.
 */
export const AGENT_VISIBLE_STATUSES: AuditStatus[] = [
  AuditStatus.PUBLISHED,
  AuditStatus.REVIEWED,
];

/**
 * Statuses in which an audit is considered immutable — no answer / score
 * / header edit is allowed. Mirrors the audit immutability promise after
 * `publish`.
 */
export const AUDIT_IMMUTABLE_STATUSES: AuditStatus[] = [
  AuditStatus.PUBLISHED,
  AuditStatus.REVIEWED,
  AuditStatus.COMPLETED,
];

/**
 * App-side mirror of `AuditQuestionType`.
 */
export const AuditQuestionType = {
  YES_NO: "YES_NO",
  MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
  RATING: "RATING",
  FREE_TEXT: "FREE_TEXT",
} as const;

export type AuditQuestionType =
  (typeof AuditQuestionType)[keyof typeof AuditQuestionType];
