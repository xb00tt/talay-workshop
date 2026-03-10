import { z } from "zod";

export const createWorkCardSchema = z.object({
  serviceSectionId: z.number().int().positive(),
  description: z.string().min(1).max(1000),
  mechanicId: z.number().int().positive().nullable().optional(),
  mechanicName: z.string().min(1).max(200),
  specialInstructions: z.string().max(2000).nullable().optional(),
});

export const updateWorkCardSchema = z.object({
  description: z.string().min(1).max(1000).optional(),
  mechanicId: z.number().int().positive().nullable().optional(),
  mechanicName: z.string().min(1).max(200).optional(),
  specialInstructions: z.string().max(2000).nullable().optional(),
  status: z.enum(["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
});

export const addWorkCardNoteSchema = z.object({
  content: z.string().min(1).max(2000),
});

export type CreateWorkCardInput = z.infer<typeof createWorkCardSchema>;
export type UpdateWorkCardInput = z.infer<typeof updateWorkCardSchema>;
export type AddWorkCardNoteInput = z.infer<typeof addWorkCardNoteSchema>;
