import { createFileRoute } from "@tanstack/react-router";
import { BuyerLayout, BuyerPageHeader } from "@/components/workspaces/buyer-layout";
import { LiveProfile } from "@/features/auth/components/live-profile";
export const Route = createFileRoute("/buyer/profile")({ component: BuyerProfilePage });
function BuyerProfilePage() {
  return (
    <BuyerLayout>
      <BuyerPageHeader
        title="Profile"
        description="Manage your account information and preferences."
      />
      <LiveProfile role="Buyer" showProfileCompletion />
    </BuyerLayout>
  );
}
