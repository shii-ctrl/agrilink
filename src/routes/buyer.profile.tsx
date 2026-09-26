import { createFileRoute } from "@tanstack/react-router";
import { BuyerLayout, BuyerPageHeader } from "@/components/buyer-layout";
import { LiveProfile } from "@/components/live-profile";
export const Route = createFileRoute("/buyer/profile")({ component: BuyerProfilePage });
function BuyerProfilePage() {
  return (
    <BuyerLayout>
      <BuyerPageHeader
        title="Profile"
        description="View and update your saved Buyer account information."
      />
      <LiveProfile role="Buyer" />
    </BuyerLayout>
  );
}
