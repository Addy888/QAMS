import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, UserPlus, Users } from "lucide-react";
import PageContainer from "@/layouts/PageContainer";
import { AppCard } from "@/components/ui/AppCard";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn, formatDate } from "@/lib/utils";
import AddUserDialog from "@/features/users/components/AddUserDialog";
import { listUsers, type ManagedUser } from "@/features/users/api";
import type { UserRole } from "@/types/navigation";

type RoleFilter = "ALL" | UserRole;

const ROLE_FILTERS: { label: string; value: RoleFilter }[] = [
  { label: "All", value: "ALL" },
  { label: "Admins", value: "ADMIN" },
  { label: "Supervisors", value: "SUPERVISOR" },
  { label: "Agents", value: "AGENT" },
];

const ROLE_TONE: Record<UserRole, "info" | "success" | "neutral"> = {
  ADMIN: "info",
  SUPERVISOR: "success",
  AGENT: "neutral",
};

const columns: DataTableColumn<ManagedUser>[] = [
  {
    key: "name",
    header: "User",
    cell: (u) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
          {u.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-fg">{u.name}</p>
          <p className="truncate text-xs text-fg-subtle">@{u.username}</p>
        </div>
      </div>
    ),
  },
  {
    key: "role",
    header: "Role",
    cell: (u) => (
      <StatusBadge tone={ROLE_TONE[u.role]}>
        {u.role.charAt(0) + u.role.slice(1).toLowerCase()}
      </StatusBadge>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (u) => (
      <StatusBadge tone={u.isActive ? "success" : "neutral"}>
        {u.isActive ? "Active" : "Inactive"}
      </StatusBadge>
    ),
  },
  {
    key: "createdAt",
    header: "Joined",
    align: "right",
    cell: (u) => (
      <span className="whitespace-nowrap text-xs text-fg-subtle">
        {formatDate(u.createdAt)}
      </span>
    ),
  },
];

/**
 * Admin Users page — mirrors the supervisor "Agents" page but at full
 * scope (all roles). Reuses the existing AddUserDialog so admins can
 * create supervisors and agents without leaving the page.
 */
export default function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RoleFilter>("ALL");
  const [addOpen, setAddOpen] = useState(false);

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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      if (filter !== "ALL" && u.role !== filter) return false;
      if (!term) return true;
      return (
        u.name.toLowerCase().includes(term) ||
        u.username.toLowerCase().includes(term) ||
        u.role.toLowerCase().includes(term)
      );
    });
  }, [users, filter, search]);

  const counts = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const admins = users.filter((u) => u.role === "ADMIN").length;
    const supervisors = users.filter((u) => u.role === "SUPERVISOR").length;
    const agents = users.filter((u) => u.role === "AGENT").length;
    return { total, active, admins, supervisors, agents };
  }, [users]);

  return (
    <PageContainer
      maxWidth="xl"
      title="Users"
      description="Every workspace member — create supervisors and agents, audit activity, and keep the directory clean."
      actions={
        <>
          <button
            onClick={() => void fetchUsers()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-elev-1 hover:opacity-90"
          >
            <UserPlus className="h-4 w-4" /> Add user
          </button>
        </>
      }
    >
      <AppCard padding="sm" className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {ROLE_FILTERS.map((f) => {
              const active = filter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium transition-colors",
                    active
                      ? "border-accent/40 bg-accent/15 text-accent"
                      : "border-border bg-bg-elevated text-fg-muted hover:bg-bg-muted hover:text-fg",
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <p className="hidden whitespace-nowrap text-xs text-fg-subtle sm:block">
              {loading
                ? "Loading…"
                : `${counts.active} active · ${counts.admins} admin · ${counts.supervisors} supervisor · ${counts.agents} agent`}
            </p>
            <div className="w-full max-w-sm">
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch("")}
                placeholder="Search by name, username or role…"
              />
            </div>
          </div>
        </div>
      </AppCard>

      {error ? (
        <EmptyState
          icon={Users}
          title="Couldn't load users"
          description={error}
          action={
            <button
              onClick={() => void fetchUsers()}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-elev-1 hover:opacity-90"
            >
              Try again
            </button>
          }
        />
      ) : (
        <DataTable<ManagedUser>
          columns={columns}
          data={filtered}
          rowKey={(u) => u.id}
          loading={loading}
          loadingRows={5}
          emptyState={
            <EmptyState
              icon={Users}
              title={search || filter !== "ALL" ? "No matching users" : "No users yet"}
              description={
                search || filter !== "ALL"
                  ? "Try a different search or filter."
                  : "Add your first supervisor or agent to get started."
              }
              action={
                !search && filter === "ALL" ? (
                  <button
                    onClick={() => setAddOpen(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-elev-1 hover:opacity-90"
                  >
                    <UserPlus className="h-4 w-4" /> Add user
                  </button>
                ) : undefined
              }
            />
          }
        />
      )}

      <AddUserDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        actorRole="ADMIN"
        onCreated={() => void fetchUsers()}
      />
    </PageContainer>
  );
}
