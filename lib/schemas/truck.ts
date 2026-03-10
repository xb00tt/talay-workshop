import { z } from "zod";

export const createTruckSchema = z.object({
  plateNumber: z.string().min(1).max(20).toUpperCase(),
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1950).max(2100).nullable().optional(),
  currentMileage: z.number().positive().nullable().optional(),
  mileageTriggerKm: z.number().positive().default(30000),
  isAdr: z.boolean().default(false),
  useCanbusMileage: z.boolean().default(true),
});

export const updateTruckSchema = createTruckSchema.partial().extend({
  isActive: z.boolean().optional(),
  currentMileage: z.number().positive().nullable().optional(),
});

export const updateMileageSchema = z.object({
  currentMileage: z.number().positive(),
});

export type CreateTruckInput = z.infer<typeof createTruckSchema>;
export type UpdateTruckInput = z.infer<typeof updateTruckSchema>;
export type UpdateMileageInput = z.infer<typeof updateMileageSchema>;
