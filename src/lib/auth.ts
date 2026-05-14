"use client";

import { supabase } from "@/lib/supabase";

export interface User {
  id: string;
  username: string;
}

// Browser-only password hashing via Web Crypto
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function register(username: string, password: string): Promise<User> {
  const password_hash = await hashPassword(password);
  const { data, error } = await supabase
    .from("users")
    .insert({ username, password_hash })
    .select("id, username")
    .single();
  if (error) {
    if (error.message?.includes("duplicate")) throw new Error("用户名已存在");
    throw new Error(error.message);
  }
  return data as User;
}

export async function login(username: string, password: string): Promise<User> {
  const password_hash = await hashPassword(password);
  const { data, error } = await supabase
    .from("users")
    .select("id, username")
    .eq("username", username)
    .eq("password_hash", password_hash)
    .single();
  if (error || !data) throw new Error("用户名或密码错误");
  return data as User;
}

// Session helpers
const SESSION_KEY = "ffc_user";

export function getSession(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function saveSession(user: User) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
