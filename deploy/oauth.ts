import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, decodeOAuthState } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) return void res.status(400).json({ error: "code and state are required" });
    const { nonce } = decodeOAuthState(state);
    const cookieOptions = getSessionCookieOptions(req);
    const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) return void res.status(403).json({ error: "invalid oauth state" });
    res.clearCookie(OAUTH_STATE_COOKIE, cookieOptions);
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) return void res.status(400).json({ error: "openId missing from user info" });
      await db.upsertUser({ openId: userInfo.openId, name: userInfo.name || null, email: userInfo.email ?? null, loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null, lastSignedIn: new Date() });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, { name: userInfo.name || "", expiresInMs: ONE_YEAR_MS });
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
