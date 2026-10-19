import { createFileRoute } from "@tanstack/react-router";
import { History, Power, Search, UserPlus, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ManagementLayout, ManagementPageHeader } from "@/components/workspaces/management-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createManagementUser,
  getGuidanceAssignments,
  getManagementAuditLogs,
  getManagementUsers,
  resetManagedUserPassword,
  setManagedUserActive,
  setGuidanceAssignment,
} from "@/services/auth/admin-server-functions";
import { minimumPasswordLength, passwordHelpText } from "@/features/auth/password-requirements";

export const Route = createFileRoute("/management/users")({
  head: () => ({
    meta: [
      { title: "User Accounts — Management | AgriLink" },
      {
        name: "description",
        content: "Management account administration for AgriLink users.",
      },
    ],
  }),
  component: ManagementUsersPage,
});

const roles = ["Management", "Marketer", "Accounting", "Farmer", "Farm Consultant"] as const;
const userRoleFilters = [
  "All",
  "Buyer",
  "Farmer",
  "Marketer",
  "Accounting",
  "Farm Consultant",
  "Management",
] as const;
type UserRoleFilter = (typeof userRoleFilters)[number];

function ManagementUsersPage() {
  const [users, setUsers] = useState<ManagementUser[]>([]);
  const [userRoleFilter, setUserRoleFilter] = useState<UserRoleFilter>("All");
  const [userSearch, setUserSearch] = useState("");
  const [guidanceAssignments, setGuidanceAssignments] = useState<Awaited<
    ReturnType<typeof getGuidanceAssignments>
  > | null>(null);
  const [auditLogs, setAuditLogs] = useState<Awaited<ReturnType<typeof getManagementAuditLogs>>>(
    [],
  );
  const loadUsers = async () => setUsers(await getManagementUsers());
  const loadGuidanceAssignments = async () =>
    setGuidanceAssignments(await getGuidanceAssignments());
  const loadAuditLogs = async () => setAuditLogs(await getManagementAuditLogs());
  const visibleUsers = useMemo(() => {
    const query = userSearch.trim().toLocaleLowerCase();
    return users.filter((user) => {
      const matchesRole = userRoleFilter === "All" || user.role === userRoleFilter;
      const matchesSearch =
        !query ||
        [user.name, user.email ?? "", user.contact ?? "", user.role].some((value) =>
          value.toLocaleLowerCase().includes(query),
        );
      return matchesRole && matchesSearch;
    });
  }, [userRoleFilter, userSearch, users]);
  // Keep the filtered account list as the source before splitting it into manageable pages.
  const usersPage = usePagination(visibleUsers.map((user) => user));
  const activityPage = usePagination(auditLogs);
  useEffect(() => {
    void loadUsers().catch(() => toast.error("Could not load saved user accounts."));
    void loadGuidanceAssignments().catch(() => toast.error("Could not load guidance assignments."));
    void loadAuditLogs().catch(() => toast.error("Could not load the Management activity log."));
  }, []);
  return (
    <ManagementLayout>
      <ManagementPageHeader
        title="User Accounts"
        description="Management creates internal accounts and can view buyer accounts. Users cannot change their own role."
      />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <Tabs defaultValue="all-users">
          <TabsList aria-label="User account sections">
            <TabsTrigger value="all-users">All Users</TabsTrigger>
            <TabsTrigger value="add-user">Add User</TabsTrigger>
            <TabsTrigger value="guidance-assignments">Guidance Assignments</TabsTrigger>
            <TabsTrigger value="reset-password">Reset Password</TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
          </TabsList>

          <TabsContent value="all-users" className="mt-6">
            <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5">
                <div>
                  <h2 className="text-lg font-semibold">All users</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Saved AgriLink accounts, including Buyer self-registration.
                  </p>
                </div>
                <div className="relative w-full max-w-md">
                  <Label htmlFor="user-search" className="sr-only">
                    Search user accounts
                  </Label>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="user-search"
                    type="search"
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Search name, email, contact, or role"
                    className="h-10 pl-9"
                  />
                </div>
              </div>

              <div className="border-b border-border bg-muted/20 px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">View accounts by role</p>
                    <p className="text-xs text-muted-foreground">
                      Showing {visibleUsers.length} of {users.length} account
                      {users.length === 1 ? "" : "s"}.
                    </p>
                  </div>
                  <div
                    className="flex flex-wrap gap-2"
                    role="group"
                    aria-label="Filter accounts by role"
                  >
                    {userRoleFilters.map((role) => {
                      const count =
                        role === "All"
                          ? users.length
                          : users.filter((user) => user.role === role).length;
                      return (
                        <Button
                          key={role}
                          type="button"
                          size="sm"
                          variant={userRoleFilter === role ? "default" : "outline"}
                          className="rounded-full"
                          onClick={() => setUserRoleFilter(role)}
                        >
                          {role} ({count})
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4 font-medium">Name</th>
                      <th className="px-6 py-4 font-medium">Contact</th>
                      <th className="px-6 py-4 font-medium">Role</th>
                      <th className="px-6 py-4 font-medium">Account Status</th>
                      <th className="px-6 py-4 font-medium">Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersPage.pageItems.map((user) => (
                      <tr key={user.id} className="border-b border-border last:border-0">
                        <td className="px-6 py-4 font-medium">{user.name}</td>
                        <td className="px-6 py-4 text-muted-foreground">{user.contact}</td>
                        <td className="px-6 py-4">{user.role}</td>
                        <td className="px-6 py-4 text-primary">
                          {user.active ? "Active" : "Inactive"}
                        </td>
                        <td className="px-6 py-4">
                          <Button
                            type="button"
                            size="sm"
                            variant={user.active ? "outline" : "default"}
                            className="rounded-full"
                            onClick={async () => {
                              const nextActive = !user.active;
                              const verb = nextActive ? "reactivate" : "deactivate";
                              if (
                                !window.confirm(`Do you want to ${verb} ${user.name}'s account?`)
                              ) {
                                return;
                              }
                              try {
                                await setManagedUserActive({
                                  data: { userId: user.id, active: nextActive },
                                });
                                try {
                                  await Promise.all([loadUsers(), loadAuditLogs()]);
                                } catch {
                                  toast.warning("Access saved, but the page could not refresh", {
                                    description:
                                      "Reload this page to see the latest account status.",
                                  });
                                }
                                toast.success(
                                  nextActive ? "Account reactivated" : "Account deactivated",
                                  {
                                    description: nextActive
                                      ? `${user.name} can sign in again.`
                                      : `${user.name}'s active sessions were signed out.`,
                                  },
                                );
                              } catch (error) {
                                toast.error("Account access could not be changed", {
                                  description:
                                    error instanceof Error ? error.message : "Please try again.",
                                });
                              }
                            }}
                          >
                            <Power />
                            {user.active ? "Deactivate" : "Reactivate"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {visibleUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                          No user accounts match this search or role section.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationControls {...usersPage} itemLabel="accounts" />
            </section>
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="flex items-start gap-3 border-b border-border px-6 py-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                  <History className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">Management activity</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The 100 most recent saved account and operational actions. Passwords and reset
                    codes are never recorded here.
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4 font-medium">When</th>
                      <th className="px-6 py-4 font-medium">Actor</th>
                      <th className="px-6 py-4 font-medium">Action</th>
                      <th className="px-6 py-4 font-medium">Record</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityPage.pageItems.map((log) => (
                      <tr key={log.id} className="border-b border-border last:border-0">
                        <td className="px-6 py-4 text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">{log.actor ?? "System"}</td>
                        <td className="px-6 py-4 font-medium">{formatAuditAction(log.action)}</td>
                        <td className="px-6 py-4 text-muted-foreground">{log.entityType}</td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                          No saved activity yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationControls {...activityPage} itemLabel="activity records" />
            </section>
          </TabsContent>

          <TabsContent value="guidance-assignments" className="mt-6">
            <section className="max-w-4xl rounded-3xl border border-border bg-card p-6 shadow-card md:p-8">
              <h2 className="text-lg font-semibold">Farmer guidance assignments</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Assign one Farm Consultant to each Farmer. Only that consultant can view and reply
                to the Farmer’s crop-guidance conversation.
              </p>
              {!guidanceAssignments?.consultants.length && (
                <p className="mt-5 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                  Create an active Farm Consultant account first, then return here to make
                  assignments.
                </p>
              )}
              <div className="mt-6 space-y-3">
                {guidanceAssignments?.farmers.map((farmer) => (
                  <form
                    key={farmer.id}
                    className="flex flex-col gap-3 rounded-2xl border border-border p-4 sm:flex-row sm:items-center"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const consultantId = String(
                        new FormData(event.currentTarget).get("consultantId") ?? "",
                      );
                      try {
                        await setGuidanceAssignment({
                          data: { farmerId: farmer.id, consultantId },
                        });
                        await loadGuidanceAssignments();
                        toast.success(`${farmer.name} has been assigned a Farm Consultant.`);
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Could not save assignment.",
                        );
                      }
                    }}
                  >
                    <p className="min-w-44 font-medium">{farmer.name}</p>
                    <select
                      name="consultantId"
                      defaultValue={farmer.consultantId ?? ""}
                      required
                      disabled={!guidanceAssignments.consultants.length}
                      className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="" disabled>
                        Select a consultant
                      </option>
                      {guidanceAssignments.consultants.map((consultant) => (
                        <option key={consultant.id} value={consultant.id}>
                          {consultant.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="submit"
                      variant="outline"
                      className="rounded-full"
                      disabled={!guidanceAssignments.consultants.length}
                    >
                      Save assignment
                    </Button>
                  </form>
                ))}
                {guidanceAssignments && !guidanceAssignments.farmers.length && (
                  <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                    No active Farmer accounts are available to assign.
                  </p>
                )}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="add-user" className="mt-6">
            <section className="max-w-3xl rounded-3xl border border-border bg-card p-6 shadow-card md:p-8">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                  <UserPlus className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">Create account</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create an internal AgriLink account. Buyer accounts register through the public
                    website.
                  </p>
                </div>
              </div>

              <form
                className="mt-8 grid gap-5 sm:grid-cols-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const formData = new FormData(form);
                  try {
                    await createManagementUser({
                      data: {
                        name: String(formData.get("name")),
                        contact: String(formData.get("contact")),
                        email: String(formData.get("email")),
                        password: String(formData.get("password")),
                        role: String(formData.get("role")) as (typeof roles)[number],
                        active: String(formData.get("status")) === "active",
                      },
                    });
                    form.reset();
                    toast.success("Account created", {
                      description: "The account is saved in AgriLink.",
                    });
                    try {
                      await loadUsers();
                    } catch {
                      toast.warning("Account saved, but the list could not refresh", {
                        description: "Reload this page to see the new account.",
                      });
                    }
                  } catch (error) {
                    toast.error("Account could not be created", {
                      description: error instanceof Error ? error.message : "Please try again.",
                    });
                  }
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="account-name">Name</Label>
                  <Input id="account-name" name="name" autoComplete="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-contact">Contact information</Label>
                  <Input
                    id="account-contact"
                    name="contact"
                    type="tel"
                    autoComplete="tel"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-role">Role</Label>
                  <select
                    id="account-role"
                    name="role"
                    required
                    defaultValue=""
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="" disabled>
                      Select a role
                    </option>
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-status">Account status</Label>
                  <select
                    id="account-status"
                    name="status"
                    defaultValue="active"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-email">Email address</Label>
                  <Input
                    id="account-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-password">Initial password</Label>
                  <Input
                    id="account-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={minimumPasswordLength}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground sm:col-span-2">{passwordHelpText}</p>
                  <Button type="submit" className="rounded-full">
                    Create account
                  </Button>
                </div>
              </form>
            </section>
          </TabsContent>

          <TabsContent value="reset-password" className="mt-6">
            <section className="max-w-3xl rounded-3xl border border-border bg-card p-6 shadow-card md:p-8">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                  <UserPlus className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">Reset an account password</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Use this only after confirming the account owner’s identity. The new password is
                    saved immediately and is never shown again.
                  </p>
                </div>
              </div>
              <form
                className="mt-8 grid gap-5 sm:grid-cols-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const formData = new FormData(form);
                  const password = String(formData.get("password") ?? "");
                  if (password !== String(formData.get("confirmPassword") ?? "")) {
                    toast.error("New passwords do not match.");
                    return;
                  }
                  try {
                    await resetManagedUserPassword({
                      data: { userId: String(formData.get("userId")), password },
                    });
                    form.reset();
                    toast.success("Password reset", {
                      description: "Give the new password to the account owner securely.",
                    });
                  } catch (error) {
                    toast.error("Password could not be reset", {
                      description: error instanceof Error ? error.message : "Please try again.",
                    });
                  }
                }}
              >
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="reset-account">Account</Label>
                  <select
                    id="reset-account"
                    name="userId"
                    defaultValue=""
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="" disabled>
                      Select an account
                    </option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} — {user.role}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-password">New password</Label>
                  <Input
                    id="reset-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={minimumPasswordLength}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-password-confirm">Confirm new password</Label>
                  <Input
                    id="reset-password-confirm"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={minimumPasswordLength}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-2">{passwordHelpText}</p>
                <div className="sm:col-span-2">
                  <Button type="submit" variant="outline" className="rounded-full">
                    Set new password
                  </Button>
                </div>
              </form>
            </section>
          </TabsContent>
        </Tabs>

        <aside className="mt-8 flex gap-3 rounded-3xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-card">
          <UsersRound className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>
            Buyer accounts can self-register in the public website. Management creates Management,
            Marketer, Accounting Personnel, Farmer Member, and Farm Consultant accounts.
          </p>
        </aside>
      </main>
    </ManagementLayout>
  );
}

function formatAuditAction(action: string) {
  return action
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" · ");
}

type ManagementUser = {
  id: string;
  name: string;
  contact: string | null;
  email: string | null;
  active: boolean;
  role: string;
};
