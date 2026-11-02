import { createFileRoute } from "@tanstack/react-router";

import { MarketerLayout, MarketerPageHeader } from "@/components/workspaces/marketer-layout";
import { DeliveryDisputeWorkspace } from "@/features/marketplace/components/delivery-dispute-workspace";

export const Route = createFileRoute("/marketer/disputes")({ component: MarketerDisputes });

function MarketerDisputes() {
  return (
    <MarketerLayout>
      <MarketerPageHeader
        title="Delivery Issues"
        description="Provide product and order information while Management reviews Buyer concerns."
      />
      <DeliveryDisputeWorkspace scopeLabel="Marketer" />
    </MarketerLayout>
  );
}
