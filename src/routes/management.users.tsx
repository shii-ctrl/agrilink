import { createFileRoute } from "@tanstack/react-router";
import { History, ImageOff, Power, Search, Trash2, UserPlus, UsersRound } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "@/lib/ui/toast";
import { ManagementLayout, ManagementPageHeader } from "@/components/workspaces/management-layout";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/profile-avatar";
import { AppSelect } from "@/components/ui/app-select";
import { useConfirmAction } from "@/components/ui/confirm-action-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { ResponsiveFilterPanel } from "@/components/data/responsive-filter-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import {
  createManagementUser,
  deleteManagedUser,
  getManagementAuditLogs,
  getManagementUsers,
  resetManagedUserPassword,
  removeManagedUserAvatar,
  setManagedUserActive,
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

const roles = ["Management", "Marketer", "Accounting", "Farmer", "Rider"] as const;
const userRoleFilters = [
  "All",
  "Buyer",
  "Farmer",
  "Marketer",
  "Accounting",
  "Rider",
  "Management",
] as const;
type UserRoleFilter = (typeof userRoleFilters)[number];
const EMPTY_USERS: ManagementUser[] = [];
const EMPTY_AUDIT_LOGS: Awaited<ReturnType<typeof getManagementAuditLogs>> = [];

function ManagedSelect({
  id,
  name,
  defaultValue = "",
  placeholder,
  options,
  disabled = false,
}: {
  id?: string;
  name: string;
  defaultValue?: string;
  placeholder: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <AppSelect
      id={id}
      name={name}
      value={value}
      onValueChange={setValue}
      onReset={() => setValue(defaultValue)}
      placeholder={placeholder}
      options={options}
      disabled={disabled}
    />
  );
}

function ManagementUsersPage() {
  const [userRoleFilter, setUserRoleFilter] = useState<UserRoleFilter>("All");
  const [userSearch, setUserSearch] = useState("");
  const { requestConfirmation, confirmationDialog } = useConfirmAction();
  const loadManagementData = useCallback(async () => {
    const [users, auditLogs] = await Promise.all([getManagementUsers(), getManagementAuditLogs()]);
    return { users, auditLogs };
  }, []);
  const { data, loading, error, reload } = useWorkspaceData(loadManagementData);
  const users = data?.users ?? EMPTY_USERS;
  const auditLogs = data?.auditLogs ?? EMPTY_AUDIT_LOGS;
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
  return (
    <ManagementLayout>
      {confirmationDialog}
      <ManagementPageHeader
        title="User Accounts"
        description="Management creates internal accounts and can view buyer accounts. Users cannot change their own role."
      />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="user-account data"
        />
        {!loading && !error && (
          <>
            <Tabs defaultValue="all-users">
              <TabsList aria-label="User account sections">
                <TabsTrigger value="all-users">All Users</TabsTrigger>
                <TabsTrigger value="add-user">Add User</TabsTrigger>
                <TabsTrigger value="reset-password">Reset Password</TabsTrigger>
                <TabsTrigger value="activity">Activity Log</TabsTrigger>
              </TabsList>

              <TabsContent value="all-users" className="mt-6">
                <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
                  <div className="border-b border-border px-6 py-5">
                    <div>
                      <h2 className="text-lg font-semibold">All users</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Saved AgriLink accounts, including Buyer self-registration.
                      </p>
                    </div>
                  </div>

                  <ResponsiveFilterPanel
                    title="Filter accounts"
                    activeCount={(userSearch ? 1 : 0) + (userRoleFilter === "All" ? 0 : 1)}
                    contentClassName="md:grid-cols-1"
                  >
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
                  </ResponsiveFilterPanel>

                  <div className="overflow-x-auto md:overflow-visible">
                    <table data-responsive-table className="w-full min-w-[960px] text-left text-sm">
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
                            <td data-label="Name" className="px-6 py-4 font-medium">
                              <div className="flex items-center gap-3">
                                <ProfileAvatar
                                  name={user.name}
                                  avatarUrl={user.avatarUrl}
                                  className="size-9"
                                />
                                <span>{user.name}</span>
                              </div>
                            </td>
                            <td data-label="Contact" className="px-6 py-4 text-muted-foreground">
                              {user.contact}
                            </td>
                            <td data-label="Role" className="px-6 py-4">
                              {user.role}
                            </td>
                            <td data-label="Account status" className="px-6 py-4 text-primary">
                              {user.active ? "Active" : "Inactive"}
                            </td>
                            <td data-label="Actions" className="px-6 py-4">
                              <div className="flex flex-wrap gap-2">
                                {user.avatarUrl && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="rounded-full"
                                    onClick={async () => {
                                      if (
                                        !(await requestConfirmation({
                                          title: `Remove ${user.name}'s profile photo?`,
                                          description:
                                            "Their initials will be shown instead. They can upload a new photo later.",
                                          confirmLabel: "Remove photo",
                                          destructive: true,
                                        }))
                                      ) {
                                        return;
                                      }
                                      try {
                                        await removeManagedUserAvatar({
                                          data: { userId: user.id },
                                        });
                                        await reload();
                                        toast.success(
                                          "Profile photo removed and activity recorded.",
                                        );
                                      } catch (error) {
                                        toast.error("Profile photo could not be removed", {
                                          description:
                                            error instanceof Error
                                              ? error.message
                                              : "Please try again.",
                                        });
                                      }
                                    }}
                                  >
                                    <ImageOff /> Remove photo
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={user.active ? "outline" : "default"}
                                  className="rounded-full"
                                  onClick={async () => {
                                    const nextActive = !user.active;
                                    if (
                                      !(await requestConfirmation({
                                        title: `${nextActive ? "Reactivate" : "Deactivate"} account?`,
                                        description: nextActive
                                          ? `${user.name} will be able to sign in again.`
                                          : `${user.name}'s active sessions will be signed out.`,
                                        confirmLabel: `${nextActive ? "Reactivate" : "Deactivate"} account`,
                                        destructive: !nextActive,
                                      }))
                                    ) {
                                      return;
                                    }
                                    try {
                                      await setManagedUserActive({
                                        data: { userId: user.id, active: nextActive },
                                      });
                                      try {
                                        await reload();
                                      } catch {
                                        toast.warning(
                                          "Access saved, but the page could not refresh",
                                          {
                                            description:
                                              "Reload this page to see the latest account status.",
                                          },
                                        );
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
                                          error instanceof Error
                                            ? error.message
                                            : "Please try again.",
                                      });
                                    }
                                  }}
                                >
                                  <Power />
                                  {user.active ? "Deactivate" : "Reactivate"}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  className="rounded-full"
                                  onClick={async () => {
                                    if (
                                      !(await requestConfirmation({
                                        title: `Permanently delete ${user.name}?`,
                                        description:
                                          "This removes the account, its private messages, notifications, drafts, and Community posts. Accounts with saved operational records cannot be deleted; deactivate those accounts instead.",
                                        confirmLabel: "Delete user",
                                        destructive: true,
                                        holdToConfirmMs: 3_000,
                                      }))
                                    ) {
                                      return;
                                    }
                                    try {
                                      await deleteManagedUser({ data: { userId: user.id } });
                                      await reload();
                                      toast.success("User account permanently deleted.");
                                    } catch (error) {
                                      toast.error("User account could not be deleted", {
                                        description:
                                          error instanceof Error
                                            ? error.message
                                            : "Please deactivate the account instead.",
                                      });
                                    }
                                  }}
                                >
                                  <Trash2 /> Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {visibleUsers.length === 0 && (
                          <tr>
                            <td
                              data-mobile-full
                              colSpan={5}
                              className="px-6 py-10 text-center text-muted-foreground"
                            >
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
                        The 100 most recent saved account and operational actions. Passwords and
                        reset codes are never recorded here.
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto md:overflow-visible">
                    <table data-responsive-table className="w-full min-w-[720px] text-left text-sm">
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
                            <td data-label="When" className="px-6 py-4 text-muted-foreground">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td data-label="Actor" className="px-6 py-4">
                              {log.actor ?? "System"}
                            </td>
                            <td data-label="Action" className="px-6 py-4 font-medium">
                              {formatAuditAction(log.action)}
                            </td>
                            <td data-label="Record" className="px-6 py-4 text-muted-foreground">
                              {log.entityType}
                            </td>
                          </tr>
                        ))}
                        {auditLogs.length === 0 && (
                          <tr>
                            <td
                              data-mobile-full
                              colSpan={4}
                              className="px-6 py-8 text-center text-muted-foreground"
                            >
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

              <TabsContent value="add-user" className="mt-6">
                <section className="max-w-3xl rounded-3xl border border-border bg-card p-6 shadow-card md:p-8">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                      <UserPlus className="size-5" />
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold">Create account</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Create an internal AgriLink account. Buyer accounts register through the
                        public website.
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
                          await reload();
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
                      <ManagedSelect
                        id="account-role"
                        name="role"
                        placeholder="Select a role"
                        options={roles.map((role) => ({ value: role, label: role }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="account-status">Account status</Label>
                      <ManagedSelect
                        id="account-status"
                        name="status"
                        defaultValue="active"
                        placeholder="Select account status"
                        options={[
                          { value: "active", label: "Active" },
                          { value: "inactive", label: "Inactive" },
                        ]}
                      />
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
                      <p className="text-xs text-muted-foreground sm:col-span-2">
                        {passwordHelpText}
                      </p>
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
                        Use this only after confirming the account owner’s identity. The new
                        password is saved immediately and is never shown again.
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
                      <ManagedSelect
                        id="reset-account"
                        name="userId"
                        placeholder="Select an account"
                        options={users.map((user) => ({
                          value: user.id,
                          label: `${user.name} — ${user.role}`,
                        }))}
                      />
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
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      {passwordHelpText}
                    </p>
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
                Buyer accounts can self-register in the public website. Management creates
                Management, Marketer, Accounting Personnel, Farmer Member, and Rider accounts.
              </p>
            </aside>
          </>
        )}
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
  avatarUrl: string | null;
};
