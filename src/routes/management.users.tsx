import { createFileRoute } from "@tanstack/react-router";
import { UserPlus, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ManagementLayout, ManagementPageHeader } from "@/components/management-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createManagementUser, getManagementUsers } from "@/lib/admin-server-functions";

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

function ManagementUsersPage() {
  const [users, setUsers] = useState<ManagementUser[]>([]);
  const loadUsers = async () => setUsers(await getManagementUsers());
  useEffect(() => {
    void loadUsers().catch(() => toast.error("Could not load saved user accounts."));
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
          </TabsList>

          <TabsContent value="all-users" className="mt-6">
            <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5">
                <div>
                  <h2 className="text-lg font-semibold">All users</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Saved MySQL accounts, including Buyer self-registration.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4 font-medium">Name</th>
                      <th className="px-6 py-4 font-medium">Contact</th>
                      <th className="px-6 py-4 font-medium">Role</th>
                      <th className="px-6 py-4 font-medium">Account Status</th>
                      <th className="px-6 py-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-border last:border-0">
                        <td className="px-6 py-4 font-medium">{user.name}</td>
                        <td className="px-6 py-4 text-muted-foreground">{user.contact}</td>
                        <td className="px-6 py-4">{user.role}</td>
                        <td className="px-6 py-4 text-primary">
                          {user.active ? "Active" : "Inactive"}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">View details</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                    Create an internal account in MySQL. Buyer accounts register through the public
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
                      description: "The account is saved in MySQL.",
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
                  <Label htmlFor="account-password">Temporary password</Label>
                  <Input
                    id="account-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" className="rounded-full">
                    Create account
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

type ManagementUser = {
  id: string;
  name: string;
  contact: string | null;
  email: string;
  active: boolean;
  role: string;
};
