import type { CookieOptions, Request } from "express";

export function getSessionCookieOptions(req: Request): CookieOptions {
  const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : true;
  const sameSite = (process.env.COOKIE_SAMESITE || (secure ? "none" : "lax")) as "lax" | "strict" | "none";
  return { httpOnly: true, path: "/", sameSite, secure };
}
