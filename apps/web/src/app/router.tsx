import { createBrowserRouter, Navigate } from "react-router-dom";
import LoginPage from "@/features/auth/pages/LoginPage";
import ProtectedRoute from "./ProtectedRoute";
import DashboardLayout from "@/layouts/DashboardLayout";

import AdminDashboard from "@/pages/admin/AdminDashboard";
import SupervisorDashboard from "@/pages/supervisor/SupervisorDashboard";
import AgentDashboard from "@/pages/agent/AgentDashboard";
import ProjectsPage from "@/pages/supervisor/ProjectsPage";
import AgentsPage from "@/pages/supervisor/AgentsPage";
import AuditsPage from "@/pages/supervisor/AuditsPage";
import SupervisorReportsPage from "@/pages/supervisor/ReportsPage";
import AnalysisDashboard from "@/pages/supervisor/analysis/AnalysisDashboard";
import ScorecardsPage from "@/pages/admin/ScorecardsPage";
import AdminUsersPage from "@/pages/admin/UsersPage";
import AdminReportsPage from "@/pages/admin/ReportsPage";
import MyAuditsPage from "@/pages/agent/MyAuditsPage";
import AuditDetailPage from "@/pages/agent/AuditDetailPage";
import { useAuthStore } from "@/features/auth/store/authStore";

/** Send the user to their role's home, or to login if anonymous. */
function RootRedirect() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  switch (user?.role) {
    case "ADMIN":
      return <Navigate to="/admin" replace />;
    case "SUPERVISOR":
      return <Navigate to="/supervisor" replace />;
    case "AGENT":
      return <Navigate to="/agent" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}

export const router = createBrowserRouter([
  { path: "/", element: <RootRedirect /> },
  { path: "/login", element: <LoginPage /> },

  // Authenticated shell — DashboardLayout renders <Outlet/>.
  {
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: "/admin",
        element: (
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/users",
        element: (
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminUsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/scorecards",
        element: (
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <ScorecardsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin/reports",
        element: (
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminReportsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/supervisor",
        element: (
          <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
            <SupervisorDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "/supervisor/projects",
        element: (
          <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
            <ProjectsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/supervisor/agents",
        element: (
          <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
            <AgentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/supervisor/audits",
        element: (
          <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
            <AuditsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/supervisor/reports",
        element: (
          <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
            <SupervisorReportsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/supervisor/analysis",
        element: (
          <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
            <AnalysisDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "/agent",
        element: (
          <ProtectedRoute allowedRoles={["AGENT"]}>
            <AgentDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "/agent/audits",
        element: (
          <ProtectedRoute allowedRoles={["AGENT"]}>
            <MyAuditsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/agent/audits/:id",
        element: (
          <ProtectedRoute allowedRoles={["AGENT"]}>
            <AuditDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        // "My Scores" sidebar entry — same view, score-focused lens.
        path: "/agent/scores",
        element: (
          <ProtectedRoute allowedRoles={["AGENT"]}>
            <MyAuditsPage />
          </ProtectedRoute>
        ),
      },
    ],
  },

  { path: "*", element: <Navigate to="/" replace /> },
]);
