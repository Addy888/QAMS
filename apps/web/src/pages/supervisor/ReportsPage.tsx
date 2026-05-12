import { ReportsView } from "@/features/reports/components/ReportsView";

/**
 * Supervisor reports — backed by `GET /audits`, which already scopes to
 * the supervisor's own audits server-side. The page is just the shared
 * reports view with role-appropriate copy.
 */
export default function ReportsPage() {
  return (
    <ReportsView
      title="Quality reports"
      description="Quality, performance and pipeline metrics for your scope of audits."
      scope="supervisor"
    />
  );
}
