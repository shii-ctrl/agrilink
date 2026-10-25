import type { Classification } from "@/features/marketplace/products";

const styles: Record<Classification, string> = {
  Good: "border-good bg-forest/95 text-white",
  Semi: "border-semi bg-forest/95 text-white",
  Reject: "border-reject bg-forest/95 text-white",
};

export function ClassificationBadge({ value }: { value: Classification }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide shadow-lg ring-1 ring-black/35 ${styles[value]}`}
    >
      {value}
    </span>
  );
}
