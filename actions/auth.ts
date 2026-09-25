"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    program: z.string().min(2, "Program / Course name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function register(formData: FormData) {
    const name = formData.get("name") as string;
    const program = formData.get("program") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const validated = registerSchema.safeParse({ name, program, email, password });

    if (!validated.success) {
        return { error: validated.error.issues[0].message };
    }

    try {
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return { error: "An account with this email already exists" };
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await prisma.user.create({
            data: {
                name,
                program: program.trim(),
                email,
                password: hashedPassword,
                role: "USER",
            },
        });

        return { success: true };
    } catch (error: any) {
        console.error("Registration error:", error);
        // Return actual error in dev so we can debug
        return { error: error?.message || "Database connection failed. Check your Supabase credentials." };
    }
}
