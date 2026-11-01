import { useState } from "react";
import { UserRound } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "A"
  );
}

export function ProfileAvatar({
  name,
  avatarUrl,
  className = "size-10",
  viewable = true,
}: {
  name: string;
  avatarUrl: string | null;
  className?: string;
  viewable?: boolean;
}) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">(
    avatarUrl ? "loading" : "idle",
  );
  const canView = Boolean(avatarUrl && status !== "error" && viewable);
  const avatar = (
    <Avatar className={`relative shrink-0 ${className}`}>
      {avatarUrl && status === "loading" && (
        <span className="absolute inset-0 animate-pulse rounded-full bg-muted" aria-hidden="true" />
      )}
      <AvatarImage
        src={avatarUrl ?? undefined}
        alt={`${name} profile photo`}
        className="object-cover"
        onLoadingStatusChange={(nextStatus) => {
          setStatus(
            nextStatus === "loaded" ? "loaded" : nextStatus === "error" ? "error" : "loading",
          );
        }}
      />
      <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
        {name ? initials(name) : <UserRound className="size-4" />}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <>
      {canView ? (
        <button
          type="button"
          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={(event) => {
            event.stopPropagation();
            setViewerOpen(true);
          }}
          aria-label={`View ${name}'s profile photo`}
        >
          {avatar}
        </button>
      ) : (
        avatar
      )}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{name}</DialogTitle>
            <DialogDescription>Profile photo</DialogDescription>
          </DialogHeader>
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt={`${name} profile photo enlarged`}
              className="mx-auto aspect-square max-h-[70vh] w-full rounded-3xl object-cover"
              onError={() => {
                setStatus("error");
                setViewerOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
