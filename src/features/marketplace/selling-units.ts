export const sellingUnits = ["kg", "piece", "bundle", "pack", "tray", "sack"] as const;
export type SellingUnit = (typeof sellingUnits)[number];

export const sellingUnitOptions = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "piece", label: "Piece" },
  { value: "bundle", label: "Bundle" },
  { value: "pack", label: "Pack" },
  { value: "tray", label: "Tray" },
  { value: "sack", label: "Sack" },
] satisfies { value: SellingUnit; label: string }[];

export function defaultSellingUnit(productName: string): SellingUnit {
  return /(^|\s)(egg|itlog)(\s|$)/i.test(productName.trim()) ? "tray" : "kg";
}

export function sellingUnitLabel(unit: SellingUnit, quantity = 1) {
  if (unit === "kg") return "kg";
  return quantity === 1 ? unit : `${unit}s`;
}

export function formatSellingQuantity(quantity: number, unit: SellingUnit) {
  return `${quantity} ${sellingUnitLabel(unit, quantity)}`;
}

export function sellingUnitStep(unit: SellingUnit) {
  return unit === "kg" ? 0.01 : 1;
}

export function requiresWholeSellingQuantity(unit: SellingUnit) {
  return unit !== "kg";
}
