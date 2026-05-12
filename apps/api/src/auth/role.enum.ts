/**
 * Mirrors the Prisma `Role` enum so the API layer can reference roles
 * without importing the generated client at the type level.
 */
export const Role = {
  ADMIN: "ADMIN",
  SUPERVISOR: "SUPERVISOR",
  AGENT: "AGENT",
} as const;

export type Role = (typeof Role)[keyof typeof Role];
