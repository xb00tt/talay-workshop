import { z } from "zod";

export const createUserSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/, "Username: letters, digits, underscore only"),
  name: z.string().min(1).max(100),
  password: z.string().min(6).max(100),
  role: z.enum(["MANAGER", "ASSISTANT"]),
  permissions: z.array(z.string()).default([]),
  preferredLocale: z.enum(["bg", "en"]).default("bg"),
  darkMode: z.boolean().default(true),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(["MANAGER", "ASSISTANT"]).optional(),
  permissions: z.array(z.string()).optional(),
  preferredLocale: z.enum(["bg", "en"]).optional(),
  darkMode: z.boolean().optional(),
  pageSize: z.number().int().min(5).max(100).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(100),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(6).max(100),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
