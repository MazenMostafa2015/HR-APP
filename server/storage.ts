import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ENV } from "./_core/env";

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "").replaceAll("\\", "/");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function isLocalStorage() {
  return process.env.STORAGE_MODE === "local" || Boolean(process.env.STORAGE_PATH);
}

function localStoragePath() {
  return path.resolve(process.env.STORAGE_PATH || path.resolve(process.cwd(), "storage"));
}

function safeLocalPath(key: string) {
  const root = localStoragePath();
  const target = path.resolve(root, normalizeKey(key));
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error("Invalid storage key");
  return target;
}

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) throw new Error("Storage config missing: set STORAGE_MODE=local and STORAGE_PATH, or MANUS_API_URL and MANUS_API_KEY");
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

export async function storagePut(relKey: string, data: Buffer | Uint8Array | string, contentType = "application/octet-stream") {
  const key = appendHashSuffix(normalizeKey(relKey));
  if (isLocalStorage()) {
    const target = safeLocalPath(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
    return { key, url: `/manus-storage/${key}` };
  }

  const { forgeUrl, forgeKey } = getForgeConfig();
  const presignUrl = new URL("v1/storage/presign/put", `${forgeUrl}/`);
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!presignResp.ok) throw new Error(`Storage presign failed (${presignResp.status}): ${await presignResp.text().catch(() => presignResp.statusText)}`);
  const { url: s3Url } = (await presignResp.json()) as { url: string };
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data as any], { type: contentType });
  const uploadResp = await fetch(s3Url, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
  if (!uploadResp.ok) throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string) {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string) {
  const key = normalizeKey(relKey);
  if (isLocalStorage()) return `/manus-storage/${key}`;
  const { forgeUrl, forgeKey } = getForgeConfig();
  const getUrl = new URL("v1/storage/presign/get", `${forgeUrl}/`);
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!resp.ok) throw new Error(`Storage signed URL failed (${resp.status}): ${await resp.text().catch(() => resp.statusText)}`);
  const { url } = (await resp.json()) as { url: string };
  if (!url) throw new Error("Storage did not return a download URL");
  return url;
}

export { isLocalStorage, safeLocalPath };
