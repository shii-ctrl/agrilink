import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, ClipboardList } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ManagementLayout, ManagementPageHeader } from "@/components/workspaces/management-layout";
import { ProductionRecordsTable } from "@/features/operations/components/production-records-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createManagementProductionRecord,
  getManagementProductionWorkspace,
} from "@/services/operations/production-server-functions";

export const Route = createFileRoute("/management/production")({
  component: ManagementProductionPage,
});

type Workspace = Awaited<ReturnType<typeof getManagementProductionWorkspace>>;

function ManagementProductionPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const load = async () => setWorkspace(await getManagementProductionWorkspace());
  useEffect(() => {
    void load().catch(() => toast.error("Could not load saved production records."));
  }, []);

  return (
    <ManagementLayout>
      <ManagementPageHeader
        title="Production"
        description="Record farmer production and harvest information in the shared AgriLink database."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-6 py-5">
            <h2 className="text-lg font-semibold">Saved production records</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Farmers can see only their own saved records; Management records the official data.
            </p>
          </div>
          <ProductionRecordsTable
            records={workspace?.records ?? []}
            emptyMessage="No production records have been saved yet."
          />
        </section>
        <section className="mt-8 max-w-3xl rounded-3xl border border-border bg-card p-6 shadow-card">
          <div className="flex gap-3">
            <ClipboardList className="mt-0.5 size-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Add production record</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                All entries are saved in AgriLink with the Management account that created them.
              </p>
            </div>
          </div>
          <form
            className="mt-6 grid gap-4 sm:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const formElement = event.currentTarget;
              const form = new FormData(formElement);
              try {
                await createManagementProductionRecord({
                  data: {
                    farmerId: String(form.get("farmerId")),
                    productId: String(form.get("productId")),
                    plantingDate: String(form.get("plantingDate")),
                    expectedHarvestDate: String(form.get("expectedHarvestDate")),
                    ...(form.get("harvestedQuantityKg")
                      ? { harvestedQuantityKg: Number(form.get("harvestedQuantityKg")) }
                      : {}),
                  },
                });
                formElement.reset();
                await load();
                toast.success("Production record saved.");
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Could not save production record.",
                );
              }
            }}
          >
            <Select label="Farmer" name="farmerId" options={workspace?.farmers ?? []} />
            <Select label="Product" name="productId" options={workspace?.products ?? []} />
            <Field name="plantingDate" label="Planting date" type="date" />
            <Field name="expectedHarvestDate" label="Expected harvest" type="date" />
            <Field
              name="harvestedQuantityKg"
              label="Harvested quantity (kg)"
              type="number"
              optional
            />
            <Button type="submit" className="self-end rounded-full">
              Save production record
            </Button>
          </form>
        </section>
        <aside className="mt-8 flex gap-3 rounded-3xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-card">
          <CalendarDays className="size-5 shrink-0 text-primary" />
          Official production records are available to the linked Farmer account and Management.
        </aside>
      </main>
    </ManagementLayout>
  );
}

function Select({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: { id: string; name: string }[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        required
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}
function Field({
  label,
  name,
  type,
  optional = false,
}: {
  label: string;
  name: string;
  type: string;
  optional?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        required={!optional}
      />
    </div>
  );
}
