import { z } from "zod";

export const registerSchema = z.object({
    nome: z.string().min(1, "O nome é obrigatório"),
    email: z.string().email("O email é inválido"),
    senha: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
})

export const loginSchema = z.object({
    email: z.string().email("O email é inválido"),
    senha: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
})

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;