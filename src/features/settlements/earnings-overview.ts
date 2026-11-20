type Amount = string | number;

type Earning = {
  receivingId: string;
  classification: string;
  quantity: Amount;
  grossAmount: Amount;
  serviceFee: Amount;
  iponContribution: Amount;
  netAmount: Amount;
  status: "pending_payment" | "available" | "paid";
};

const sum = <T>(rows: T[], value: (row: T) => Amount) =>
  rows.reduce((total, row) => total + Math.round(Number(value(row)) * 100), 0) / 100;

export function earningsSummary(rows: Earning[]) {
  return {
    grossSales: sum(rows, (row) => row.grossAmount),
    serviceFee: sum(rows, (row) => row.serviceFee),
    iponSavings: sum(rows, (row) => row.iponContribution),
    netEarnings: sum(rows, (row) => row.netAmount),
    awaitingPayment: sum(
      rows.filter((row) => row.status === "pending_payment"),
      (row) => row.netAmount,
    ),
    availableCash: sum(
      rows.filter((row) => row.status === "available"),
      (row) => row.netAmount,
    ),
    paidCash: sum(
      rows.filter((row) => row.status === "paid"),
      (row) => row.netAmount,
    ),
  };
}

export function deliveryEarnings<D extends { id: string }, L extends Earning>(
  deliveries: D[],
  classifications: { receivingId: string; classification: string; quantity: Amount }[],
  stock: {
    receivingId: string | null;
    classification: string;
    quantity: Amount;
    reserved: Amount;
  }[],
  earnings: L[],
) {
  return deliveries.map((delivery) => {
    const lines = earnings.filter((line) => line.receivingId === delivery.id);
    const batches = stock.filter((batch) => batch.receivingId === delivery.id);
    const remainingQuantity = sum(batches, (batch) => batch.quantity);
    const reservedQuantity = sum(batches, (batch) => batch.reserved);
    return {
      ...delivery,
      summary: earningsSummary(lines),
      soldQuantity: sum(lines, (line) => line.quantity),
      remainingQuantity,
      reservedQuantity,
      availableQuantity: Math.max(
        0,
        Math.round((remainingQuantity - reservedQuantity) * 100) / 100,
      ),
      classifications: classifications
        .filter((row) => row.receivingId === delivery.id)
        .map((row) => {
          const classifiedStock = batches.filter(
            (batch) => batch.classification === row.classification,
          );
          return {
            classification: row.classification,
            receivedQuantity: Number(row.quantity),
            soldQuantity: sum(
              lines.filter((line) => line.classification === row.classification),
              (line) => line.quantity,
            ),
            remainingQuantity: sum(classifiedStock, (batch) => batch.quantity),
            reservedQuantity: sum(classifiedStock, (batch) => batch.reserved),
          };
        }),
      lines,
    };
  });
}
