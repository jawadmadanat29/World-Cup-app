"use server";
import { redirect } from "next/navigation";
import { checkAdminPassword, startAdminSession, endAdminSession } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";

export interface LoginState {
  error?: string;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { error: "Password is required." };
  if (!checkAdminPassword(parsed.data.password)) return { error: "Incorrect password. Try again." };

  await startAdminSession();
  const from = formData.get("from")?.toString() ?? "";
  redirect(from.startsWith("/admin") ? from : "/admin");
}

export async function logout(): Promise<void> {
  await endAdminSession();
  redirect("/");
}
