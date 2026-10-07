import type { Express } from "express";
import { ENV } from "./env";
import { isLocalStorage, safeLocalPath } from "../storage";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) return void res.status(400).send("Missing storage key");

    if (isLocalStorage()) {
      try {
        return void res.sendFile(safeLocalPath(key), { dotfiles: "deny" }, error => {
          const statusCode = error && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
          if (error && !res.headersSent) res.status(statusCode === 404 ? 404 : 500).send("Attachment unavailable");
        });
      } catch {
        return void res.status(400).send("Invalid storage key");
      }
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) return void res.status(500).send("Storage proxy not configured");
    try {
      const forgeUrl = new URL("v1/storage/presign/get", `${ENV.forgeApiUrl.replace(/\/+$/, "")}/`);
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, { headers: { Authorization: `Bearer ${ENV.forgeApiKey}` } });
      if (!forgeResp.ok) return void res.status(502).send("Storage backend error");
      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) return void res.status(502).send("Empty signed URL from backend");
      res.set("Cache-Control", "no-store").redirect(307, url);
    } catch (error) {
      console.error("[StorageProxy] failed:", error);
      res.status(502).send("Storage proxy error");
    }
  });
}
