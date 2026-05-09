import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Trophy,
  History,
  FolderKanban,
  UserSquare2,
} from "lucide-react";
import type { NavGroup, UserRole } from "@/types/navigation";

/**
 * Centralized, role-aware sidebar configuration.
 *
 * Add or reorder routes here. Layouts/sidebar components
 * read this map and render the correct group set per role.
 */
export const SIDEBAR_CONFIG: Record<UserRole, NavGroup[]> = {
  ADMIN: [
    {
      heading: "Overview",
      items: [
        { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
      ],
    },
    {
      heading: "Administration",
      items: [
        { label: "Users", path: "/admin/users", icon: Users },
        { label: "Scorecards", path: "/admin/scorecards", icon: ClipboardList },
      ],
    },
  ],

  SUPERVISOR: [
    {
      heading: "Overview",
      items: [
        { label: "Dashboard", path: "/supervisor", icon: LayoutDashboard },
      ],
    },
    {
      heading: "Workspace",
      items: [
        { label: "Projects", path: "/supervisor/projects", icon: FolderKanban },
        { label: "Agents", path: "/supervisor/agents", icon: UserSquare2 },
      ],
    },
    {
      heading: "Operations",
      items: [
        { label: "Audits", path: "/supervisor/audits", icon: ClipboardList },
      ],
    },
  ],

  AGENT: [
    {
      heading: "Overview",
      items: [
        { label: "Dashboard", path: "/agent", icon: LayoutDashboard },
      ],
    },
    {
      heading: "Performance",
      items: [
        { label: "My Audits", path: "/agent/audits", icon: ClipboardList },
        { label: "My Scores", path: "/agent/scores", icon: Trophy },
        {
          label: "Audit History",
          path: "/agent/audits?lens=REVIEWED",
          icon: History,
        },
      ],
    },
  ],
};

/** Resolve the correct nav-group list for a given role (or empty if unknown). */
export function getSidebarGroups(role: UserRole | null | undefined): NavGroup[] {
  if (!role) return [];
  return SIDEBAR_CONFIG[role] ?? [];
}
