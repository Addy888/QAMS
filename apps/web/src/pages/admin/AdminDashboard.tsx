import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ClipboardList,
  ShieldCheck,
  UserPlus,
  UserSquare2,
  Users,
} from "lucide-react";
import PageContainer from "@/layouts/PageContainer";
import { WelcomeHeader } from "@/features/dashboard/components/WelcomeHeader";
import { StatCard } from "@/components/ui/StatCard";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AddUserDialog } from "@/features/users/components/AddUserDialog";
import { listUsers, type ManagedUser } from "@/features/users/api";
import { formatDate } from "@/lib/utils";

/**
 * Admin dashboard — focused, real-data overview. No mock metrics, no
 * decorative charts. Shows the current directory shape (admins,
 * supervisors, agents) and the most recently created users so the
 * admin has a single glanceable home page.
 */
export default function AdminDashboard() {
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (e) {
      console.error(e);
      setError("Could not load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const supervisors = users.filter((u) => u.role === "SUPERVISOR").length;
    const agents = users.filter((u) => u.role === "AGENT").length;
    return { total, active, supervisors, agents };
  }, [users]);

  const recentUsers = useMemo(() => {
    return [...users]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 6);
  }, [users]);

  return (
    <PageContainer maxWidth="xl">
      <WelcomeHeader
        eyebrow="Admin overview"
        description="Manage workspace users and the global QA template."
        actions={
          <>
            <Link
              to="/admin/users"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
            >
              <Users className="h-4 w-4" /> View users
            </Link>
            <button
              onClick={() => setAddUserOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-elev-1 hover:opacity-90"
            >
              <UserPlus className="h-4 w-4" /> Add user
            </button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total users"
          value={loading ? "—" : stats.total}
          icon={Users}
          description={`${stats.active} active`}
          loading={loading}
        />
        <StatCard
          label="Supervisors"
          value={loading ? "—" : stats.supervisors}
          icon={ShieldCheck}
          loading={loading}
        />
        <StatCard
          label="Agents"
          value={loading ? "—" : stats.agents}
          icon={UserSquare2}
          loading={loading}
        />
        <StatCard
          label="QA template"
          value="Global"
          icon={ClipboardList}
          description="Shared across all audits"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <AppCard
          padding="none"
          className="lg:col-span-2"
          header={
            <>
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-fg">
                  Recently added users
                </h3>
                <p className="text-xs text-fg-subtle">
                  Latest entries in the directory
                </p>
              </div>
              <Link
                to="/admin/users"
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </>
          }
        >
          {loading ? (
            <div className="p-5">
              <LoadingSkeleton rows={5} />
            </div>
          ) : error ? (
            <EmptyState
              title="Couldn't load users"
              description={error}
              className="border-none bg-transparent"
            />
          ) : recentUsers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users yet"
              description="Add your first supervisor or agent to get started."
              className="border-none bg-transparent"
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentUsers.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">
                      {u.name}
                    </p>
                    <p className="truncate text-xs text-fg-subtle">
                      @{u.username}
                    </p>
                  </div>
                  <StatusBadge
                    tone={
                      u.role === "ADMIN"
                        ? "info"
                        : u.role === "SUPERVISOR"
                          ? "success"
                          : "neutral"
                    }
                  >
                    {u.role.charAt(0) + u.role.slice(1).toLowerCase()}
                  </StatusBadge>
                  <span className="hidden whitespace-nowrap text-xs text-fg-subtle sm:inline">
                    {formatDate(u.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AppCard>

        <AppCard
          header={
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-fg">
                Quick actions
              </h3>
              <p className="text-xs text-fg-subtle">Most common admin tasks</p>
            </div>
          }
        >
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setAddUserOpen(true)}
              className="inline-flex h-10 items-center justify-between gap-2 rounded-md border border-border bg-bg-elevated px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
            >
              <span className="inline-flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-accent" />
                Add user
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-fg-subtle" />
            </button>
            <Link
              to="/admin/users"
              className="inline-flex h-10 items-center justify-between gap-2 rounded-md border border-border bg-bg-elevated px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
            >
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" />
                Manage users
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-fg-subtle" />
            </Link>
            <Link
              to="/admin/scorecards"
              className="inline-flex h-10 items-center justify-between gap-2 rounded-md border border-border bg-bg-elevated px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
            >
              <span className="inline-flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-accent" />
                Edit QA template
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-fg-subtle" />
            </Link>
          </div>
        </AppCard>
      </div>

      <AddUserDialog
        open={addUserOpen}
        onOpenChange={setAddUserOpen}
        actorRole="ADMIN"
        onCreated={() => void fetchUsers()}
      />
    </PageContainer>
  );
}
