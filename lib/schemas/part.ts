import { z } from "zod";

export const addPartSchema = z.object({
  name: z.string().min(1).max(200),
  partNumber: z.string().max(100).nullable().optional(),
  quantity: z.number().positive(),
  unitCost: z.number().min(0).nullable().optional(),
});

export const updatePartSchema = addPartSchema.partial();

export type AddPartInput = z.infer<typeof addPartSchema>;
export type UpdatePartInput = z.infer<typeof updatePartSchema>;
