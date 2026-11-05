import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/ui/toast";
import { backgroundMutationHeader } from "@/lib/data/live-refresh";
import {
  getLegacyCatalogPhotoCount,
  migrateNextCatalogPhoto,
} from "@/services/marketplace/catalog-photo-migration";

export function CatalogPhotoMaintenance({ onSaved }: { onSaved: () => Promise<void> }) {
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const busy = useRef(false);
  const stop = useRef(false);

  const migrate = async () => {
    if (busy.current) return;
    busy.current = true;
    stop.current = false;
    setRunning(true);
    try {
      let count = (await getLegacyCatalogPhotoCount()).remaining;
      setRemaining(count);
      while (count > 0 && !stop.current) {
        const result = await migrateNextCatalogPhoto({
          headers: { [backgroundMutationHeader]: "true" },
        });
        count = result.remaining;
        setRemaining(count);
        if (!result.updated && count > 0) break;
      }
      if (!count) toast.success("Older catalog photos moved to Cloudinary");
    } catch (error) {
      toast.error("Photo transfer paused", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      busy.current = false;
      setRunning(false);
      await onSaved().catch(() => undefined);
    }
  };

  return (
    <div className="mt-4 space-y-2 border-t border-border pt-3">
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={running}
        onClick={() => void migrate()}
      >
        {running ? "Moving older photos…" : "Optimize older photos"}
      </Button>
      {remaining !== null ? (
        <p role="status" className="text-xs text-muted-foreground">
          {remaining} saved photo references remaining
        </p>
      ) : null}
      {running ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            stop.current = true;
          }}
        >
          Pause after current photo
        </Button>
      ) : null}
    </div>
  );
}
