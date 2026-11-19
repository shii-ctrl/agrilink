import { z } from "zod";

export const walkInOrderInput = z.object({
  requestId: z.string().uuid(),
  buyerName: z.string().trim().min(2).max(160),
  contact: z.string().trim().max(80).default(""),
  items: z
    .array(
      z.object({
        listingId: z.string().uuid(),
        quantityKg: z.number().positive().max(999999).multipleOf(0.01),
        expectedUnitPrice: z.number().nonnegative().max(999999999).multipleOf(0.01),
      }),
    )
    .min(1)
    .max(50)
    .refine((items) => new Set(items.map((item) => item.listingId)).size === items.length, {
      message: "Select each product and classification only once.",
    }),
});
