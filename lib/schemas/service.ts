import { z } from "zod";

export const createServiceSchema = z.object({
  truckId: z.number().int().positive(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format required"),
  driverId: z.number().int().positive().nullable().optional(),
});

export const updateServiceStatusSchema = z.object({
  status: z.enum(["INTAKE", "IN_PROGRESS", "QUALITY_CHECK", "READY", "COMPLETED"]),
  bayId: z.number().int().positive().nullable().optional(),
  bayNameSnapshot: z.string().optional(),
  mileageAtService: z.number().positive().nullable().optional(),
  driverId: z.number().int().positive().nullable().optional(),
  driverNameSnapshot: z.string().nullable().optional(),
  skipWarning: z.boolean().optional(),
});

export const cancelServiceSchema = z.object({
  cancellationReason: z.string().min(1, "Cancellation reason is required").max(500),
});

export const rescheduleServiceSchema = z.object({
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format required"),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceStatusInput = z.infer<typeof updateServiceStatusSchema>;
export type CancelServiceInput = z.infer<typeof cancelServiceSchema>;
export type RescheduleServiceInput = z.infer<typeof rescheduleServiceSchema>;
