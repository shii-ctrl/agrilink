import { createFileRoute } from "@tanstack/react-router";
import { Bike, CircleDollarSign, ShieldCheck } from "lucide-react";
import { useCallback } from "react";

import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { Card, CardContent } from "@/components/ui/card";
import { RiderLayout, RiderPageHeader } from "@/components/workspaces/rider-layout";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { getRiderDeliveryStatus } from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/rider/")({ component: RiderDashboard });

function RiderDashboard() {
  const request = useCallback(() => getRiderDeliveryStatus(), []);
  const { data, loading, error, reload } = useWorkspaceData(request);

  return (
    <RiderLayout>
      <RiderPageHeader
        title="Rider Workspace"
        description="Check delivery availability. Delivery assignments will appear here when Management sends them to you."
      />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="rider workspace"
        />
        {!loading && !error && data ? (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <Card className="shadow-card">
                <CardContent className="p-5">
                  <Bike className="size-5 text-primary" />
                  <p className="mt-4 text-sm text-muted-foreground">Delivery checkout</p>
                  <p className="mt-1 font-display text-3xl font-semibold">
                    {data.deliveryEnabled ? "On" : "Off"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Management controls whether buyers may choose delivery.
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-5">
                  <CircleDollarSign className="size-5 text-primary" />
                  <p className="mt-4 text-sm text-muted-foreground">Delivery fee</p>
                  <p className="mt-1 font-display text-3xl font-semibold">
                    ₱{data.deliveryFee.toFixed(2)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    The current flat fee shown to buyers at checkout.
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-5">
                  <ShieldCheck className="size-5 text-primary" />
                  <p className="mt-4 text-sm text-muted-foreground">Account access</p>
                  <p className="mt-1 font-display text-3xl font-semibold">Active</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your Rider account was created and is managed by Management.
                  </p>
                </CardContent>
              </Card>
            </section>
            <section className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-card">
              <h2 className="text-lg font-semibold">No delivery assignments yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This workspace is ready for delivery assignments and proof-of-delivery tracking.
                Management can turn delivery off whenever no Rider is available.
              </p>
            </section>
          </>
        ) : null}
      </main>
    </RiderLayout>
  );
}
