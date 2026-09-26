import { createFileRoute } from "@tanstack/react-router";
import { AccountingLayout, AccountingPageHeader } from "@/components/accounting-layout";
import { LiveProfile } from "@/components/live-profile";
export const Route = createFileRoute("/accounting/profile")({ component: AccountingProfilePage });
function AccountingProfilePage() {
  return (
    <AccountingLayout>
      <AccountingPageHeader
        title="Profile"
        description="View and update your saved Accounting account information."
      />
      <LiveProfile role="Accounting" />
    </AccountingLayout>
  );
}
