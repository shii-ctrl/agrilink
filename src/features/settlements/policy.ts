export const FARMER_SERVICE_FEE_PER_KILOGRAM = 1.25;
export const FARMER_IPON_PER_KILOGRAM = 0.5;
export const FARMER_TOTAL_DEDUCTION_PER_KILOGRAM = 1.75;

export const settlementMoney = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
