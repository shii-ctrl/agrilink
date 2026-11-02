export const sellingUnits = ["kg", "tray"] as const;
export type SellingUnit = (typeof sellingUnits)[number];

export const sellingUnitOptions = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "tray", label: "Tray" },
] satisfies { value: SellingUnit; label: string }[];

export function defaultSellingUnit(productName: string): SellingUnit {
  return /(^|\s)(egg|itlog)(\s|$)/i.test(productName.trim()) ? "tray" : "kg";
}

export function sellingUnitLabel(unit: SellingUnit, quantity = 1) {
  if (unit === "tray") return quantity === 1 ? "tray" : "trays";
  return "kg";
}

export function formatSellingQuantity(quantity: number, unit: SellingUnit) {
  return `${quantity} ${sellingUnitLabel(unit, quantity)}`;
}

export function sellingUnitStep(unit: SellingUnit) {
  return unit === "tray" ? 1 : 0.01;
}
