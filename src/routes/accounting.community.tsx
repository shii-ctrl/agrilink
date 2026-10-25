import { createFileRoute } from "@tanstack/react-router";

import { AccountingLayout, AccountingPageHeader } from "@/components/workspaces/accounting-layout";
import { CommunityWorkspace } from "@/features/messaging/components/community-workspace";

export const Route = createFileRoute("/accounting/community")({
  component: AccountingCommunityPage,
});

function AccountingCommunityPage() {
  return (
    <AccountingLayout>
      <AccountingPageHeader
        title="Community"
        description="Share updates with AgriLink members and read role-protected private messages."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <CommunityWorkspace
          postTitle="Share an accounting update"
          placeholder="What is on your mind? Share an update with the AgriLink community..."
        />
      </main>
    </AccountingLayout>
  );
}
