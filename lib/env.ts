const SECRET_ENV_NAMES = ["DATABASE_URL", "DATABASE_URL_UNPOOLED"] as const;

type SecretEnvName = (typeof SECRET_ENV_NAMES)[number];

function assertServerOnly(name: SecretEnvName) {
  if (typeof window !== "undefined") {
    throw new Error(`${name} is server-only`);
  }

  const publicName = `NEXT_PUBLIC_${name}`;
  if (process.env[publicName]) {
    throw new Error(`${publicName} would expose a secret to the browser`);
  }
}

function readSecret(name: SecretEnvName): string {
  assertServerOnly(name);

  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
}

function assertSecurePostgresUrl(name: SecretEnvName, value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL connection URL`);
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error(`${name} must use the postgresql protocol`);
  }

  if (!url.username || !url.password) {
    throw new Error(`${name} must include a username and password`);
  }

  if (url.searchParams.get("sslmode") !== "require") {
    throw new Error(`${name} must set sslmode=require`);
  }

  if (url.searchParams.get("channel_binding") !== "require") {
    throw new Error(`${name} must set channel_binding=require`);
  }
}

export function getDatabaseUrl(): string {
  const value = readSecret("DATABASE_URL");
  assertSecurePostgresUrl("DATABASE_URL", value);
  return value;
}

export function getDirectDatabaseUrl(): string {
  const value = readSecret("DATABASE_URL_UNPOOLED");
  assertSecurePostgresUrl("DATABASE_URL_UNPOOLED", value);
  return value;
}
