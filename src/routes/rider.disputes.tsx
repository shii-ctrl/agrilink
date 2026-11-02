import { createFileRoute } from "@tanstack/react-router";

import { RiderLayout, RiderPageHeader } from "@/components/workspaces/rider-layout";
import { DeliveryDisputeWorkspace } from "@/features/marketplace/components/delivery-dispute-workspace";

export const Route = createFileRoute("/rider/disputes")({ component: RiderDisputes });

function RiderDisputes() {
  return (
    <RiderLayout>
      <RiderPageHeader
        title="Delivery Issues"
        description="Respond to Buyer concerns connected to deliveries assigned to you."
      />
      <DeliveryDisputeWorkspace scopeLabel="Rider" />
    </RiderLayout>
  );
}
