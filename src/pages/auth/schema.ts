import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Username or Access Key ID is required"),
  password: z.string().min(1, "Password or Secret Access Key is required"),
});
