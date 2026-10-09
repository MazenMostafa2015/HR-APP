// Platform values are read at use time. See the Webdev service/authentication skills.
export const ENV = {
  get appId() { return process.env.MANUS_PROJECT_ID ?? ""; },
  get cookieSecret() { return process.env.MANUS_JWT_SECRET ?? ""; },
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  get oAuthServerUrl() { return process.env.MANUS_OAUTH_API_URL ?? ""; },
  // Preserve the legacy hint when supplied; otherwise roles remain application data.
  get ownerOpenId() { return process.env.OWNER_OPEN_ID ?? ""; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  get forgeApiUrl() { return process.env.MANUS_API_URL ?? ""; },
  get forgeApiKey() { return process.env.MANUS_API_KEY ?? ""; },
};

# Runtime
NODE_ENV=production
PORT=3000

# MySQL: create the elms database and user before starting the server.
DATABASE_URL=mysql://elms_app:REPLACE_WITH_PASSWORD@127.0.0.1:3306/elms

# Session and OAuth. Keep secrets server-side and generate a long random JWT secret.
MANUS_PROJECT_ID=internal-elms
MANUS_JWT_SECRET=REPLACE_WITH_LONG_RANDOM_SECRET
MANUS_OAUTH_API_URL=https://YOUR-OAUTH-BROKER.example.com
MANUS_OAUTH_PORTAL_URL=https://YOUR-OAUTH-BROKER.example.com
OWNER_OPEN_ID=REPLACE_WITH_IT_ADMIN_OPEN_ID

# Local attachment storage (recommended for internal deployment)
STORAGE_MODE=local
STORAGE_PATH=C:\ProgramData\ELMS\storage

# Cookie behavior. Use COOKIE_SECURE=true when the server is behind HTTPS.
COOKIE_SECURE=true
COOKIE_SAMESITE=lax

# Optional SMTP notifications
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=ELMS <noreply@company.example>