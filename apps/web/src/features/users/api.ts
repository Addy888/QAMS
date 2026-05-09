import { api } from "@/services/api";
import type { UserRole } from "@/types/navigation";

export interface CreateUserPayload {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  role: Exclude<UserRole, "ADMIN">;
}

export interface ManagedUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Backwards-compat alias — kept so existing imports don't break. */
export type CreatedUser = ManagedUser;

export async function createUser(
  payload: CreateUserPayload,
): Promise<ManagedUser> {
  const response = await api.post<ManagedUser>("/users", payload);
  return response.data;
}

/**
 * List users — optionally filter by role. The backend already exposes
 * this endpoint for both Admin and Supervisor scopes; the Admin Users
 * page hits it without a role filter, the Supervisor Agents page
 * passes `role=AGENT`.
 */
export async function listUsers(role?: UserRole): Promise<ManagedUser[]> {
  const response = await api.get<ManagedUser[]>("/users", {
    params: role ? { role } : {},
  });
  return response.data;
}
