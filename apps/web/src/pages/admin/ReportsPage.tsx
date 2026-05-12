import { ReportsView } from "@/features/reports/components/ReportsView";

/**
 * Admin reports — backed by `GET /audits` which returns the workspace-
 * wide list when the actor is ADMIN. The view is identical to the
 * supervisor page, just with a workspace-wide framing.
 */
export default function ReportsPage() {
  return (
    <ReportsView
      title="Quality overview"
      description="Workspace-wide quality, performance and pipeline metrics."
      scope="admin"
    />
  );
}
