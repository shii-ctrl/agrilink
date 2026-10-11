import type { Classification } from "@/features/marketplace/products";

const styles: Record<Classification, string> = {
  Good: "bg-good/15 text-good border-good/30",
  Semi: "bg-semi/15 text-semi border-semi/40",
  Reject: "bg-reject/15 text-reject border-reject/30",
};

export function ClassificationBadge({ value }: { value: Classification }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide backdrop-blur ${styles[value]}`}
    >
      {value}
    </span>
  );
}
