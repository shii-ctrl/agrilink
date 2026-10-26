import { MessageCircle, UsersRound } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommunityFeed } from "@/features/messaging/components/community-feed";
import { DirectMessagesPanel } from "@/features/messaging/components/direct-messages-panel";

type CommunityWorkspaceProps = {
  postTitle: string;
  placeholder: string;
  messagesOnly?: boolean;
};

export function CommunityWorkspace({
  postTitle,
  placeholder,
  messagesOnly = false,
}: CommunityWorkspaceProps) {
  if (messagesOnly) {
    return <DirectMessagesPanel />;
  }

  return (
    <Tabs defaultValue="feed">
      <TabsList className="h-auto rounded-2xl p-1">
        <TabsTrigger value="feed" className="gap-2 rounded-xl px-4 py-2">
          <UsersRound className="size-4" /> Community feed
        </TabsTrigger>
        <TabsTrigger value="messages" className="gap-2 rounded-xl px-4 py-2">
          <MessageCircle className="size-4" /> Private messages
        </TabsTrigger>
      </TabsList>
      <TabsContent value="feed" className="mt-6">
        <CommunityFeed title={postTitle} placeholder={placeholder} />
      </TabsContent>
      <TabsContent value="messages" className="mt-6">
        <DirectMessagesPanel />
      </TabsContent>
    </Tabs>
  );
}
