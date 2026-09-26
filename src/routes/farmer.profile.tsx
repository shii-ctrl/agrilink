import { createFileRoute } from "@tanstack/react-router";
import { FarmerLayout, FarmerPageHeader } from "@/components/farmer-layout";
import { LiveProfile } from "@/components/live-profile";
export const Route = createFileRoute("/farmer/profile")({ component: FarmerProfilePage });
function FarmerProfilePage() {
  return (
    <FarmerLayout>
      <FarmerPageHeader
        title="Profile"
        description="View and update your saved Farmer account information."
      />
      <LiveProfile role="Farmer" />
    </FarmerLayout>
  );
}
