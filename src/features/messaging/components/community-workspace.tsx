import { MessageCircle, UsersRound } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommunityFeed } from "@/features/messaging/components/community-feed";
import { DirectMessagesPanel } from "@/features/messaging/components/direct-messages-panel";

type CommunityWorkspaceProps = {
  postTitle: string;
  placeholder: string;
  messagesOnly?: boolean;
  initialContactId?: string | undefined;
};

export function CommunityWorkspace({
  postTitle,
  placeholder,
  messagesOnly = false,
  initialContactId,
}: CommunityWorkspaceProps) {
  if (messagesOnly) {
    return <DirectMessagesPanel initialContactId={initialContactId} />;
  }

  return (
    <Tabs defaultValue="feed" className="min-w-0">
      <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl p-1 sm:inline-grid sm:w-auto">
        <TabsTrigger value="feed" className="min-w-0 gap-2 rounded-xl px-2 py-2.5 sm:px-4">
          <UsersRound className="size-4" /> Community feed
        </TabsTrigger>
        <TabsTrigger value="messages" className="min-w-0 gap-2 rounded-xl px-2 py-2.5 sm:px-4">
          <MessageCircle className="size-4" /> Private messages
        </TabsTrigger>
      </TabsList>
      <TabsContent value="feed" className="mt-3 sm:mt-6">
        <CommunityFeed title={postTitle} placeholder={placeholder} />
      </TabsContent>
      <TabsContent value="messages" className="mt-3 sm:mt-6">
        <DirectMessagesPanel initialContactId={initialContactId} />
      </TabsContent>
    </Tabs>
  );
}
