import { api } from "@/services/api";
import type { UserRole } from "@/types/navigation";

export interface CreateUserPayload {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  role: Exclude<UserRole, "ADMIN">;
}

export interface CreatedUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function createUser(payload: CreateUserPayload): Promise<CreatedUser> {
  const response = await api.post<CreatedUser>("/users", payload);
  return response.data;
}
