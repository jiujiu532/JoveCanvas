export type DeployMode = "local" | "docker" | "baota" | "cloud";

// 模式的展示文案（label/description）随语言切换，由调用方通过 next-intl 翻译后再渲染，这里只保留纯数据字段
export const modeOptions: Array<{ value: DeployMode; host: string; ssl: boolean }> = [
    { value: "local", host: "localhost", ssl: false },
    { value: "docker", host: "postgres", ssl: false },
    { value: "baota", host: "127.0.0.1", ssl: false },
    { value: "cloud", host: "db.example.com", ssl: true },
];

type DatabaseConfig = {
    mode: DeployMode;
    host: string;
    port: string;
    database: string;
    username: string;
    password: string;
    ssl: boolean;
    encryptionKey: string;
};

export function generateEncryptionKey() {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function buildDeploymentSnippets(config: DatabaseConfig) {
    const host = config.host.trim() || "localhost";
    const port = config.port.trim() || "5432";
    const database = config.database.trim() || "vozeb_pro";
    const username = config.username.trim() || "vozeb_pro";
    const databaseUrl = buildPostgresUrl({ database, host, password: config.password, port, username });
    const envText = `VOZEB_PRO_DATABASE_PROVIDER=postgres
DATABASE_URL=${databaseUrl}
VOZEB_PRO_DATABASE_POOL_MAX=10
VOZEB_PRO_DATABASE_SSL=${config.ssl ? "1" : "0"}
VOZEB_PRO_ENCRYPTION_KEY=${config.encryptionKey}${config.mode === "baota" ? "\nVOZEB_PRO_TRUSTED_PROXY_HOPS=1" : ""}`;

    return {
        envText,
        composeText: config.mode === "docker" ? bundledCompose(config, database, username) : config.mode === "baota" ? baotaCompose(config, databaseUrl) : externalCompose(config, databaseUrl),
        sqlText: `psql -h ${shellArg(host)} -p ${shellArg(port)} -U postgres <<'SQL'
DO $$
BEGIN
    CREATE ROLE ${sqlIdentifier(username)} LOGIN PASSWORD ${sqlLiteral(config.password)};
EXCEPTION WHEN duplicate_object THEN
    ALTER ROLE ${sqlIdentifier(username)} WITH PASSWORD ${sqlLiteral(config.password)};
END $$;
SELECT 'CREATE DATABASE ${sqlIdentifier(database)} OWNER ${sqlIdentifier(username)}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = ${sqlLiteral(database)})\gexec
SQL`,
    };
}

function bundledCompose(config: DatabaseConfig, database: string, username: string) {
    const databaseUrl = buildPostgresUrl({ database, host: "postgres", password: config.password, port: "5432", username });
    return `services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${quoteYaml(database)}
      POSTGRES_USER: ${quoteYaml(username)}
      POSTGRES_PASSWORD: ${quoteYaml(config.password)}
    volumes:
      - vozeb-pro-postgres:/var/lib/postgresql/data
    restart: unless-stopped

  app:
    image: ghcr.io/jiujiu532/jovecanvas:latest
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - vozeb-pro-data:/app/web/.data
    environment:
      VOZEB_PRO_DATABASE_PROVIDER: "postgres"
      DATABASE_URL: ${quoteYaml(databaseUrl)}
      VOZEB_PRO_DATABASE_SSL: "0"
      VOZEB_PRO_ENCRYPTION_KEY: ${quoteYaml(config.encryptionKey)}
    depends_on:
      - postgres
    restart: unless-stopped

volumes:
  vozeb-pro-data:
  vozeb-pro-postgres:`;
}

function externalCompose(config: DatabaseConfig, databaseUrl: string) {
    return `services:
  app:
    image: ghcr.io/jiujiu532/jovecanvas:latest
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - vozeb-pro-data:/app/web/.data
    environment:
      VOZEB_PRO_DATABASE_PROVIDER: "postgres"
      DATABASE_URL: ${quoteYaml(databaseUrl)}
      VOZEB_PRO_DATABASE_SSL: "${config.ssl ? "1" : "0"}"
      VOZEB_PRO_ENCRYPTION_KEY: ${quoteYaml(config.encryptionKey)}
    restart: unless-stopped

volumes:
  vozeb-pro-data:`;
}

function baotaCompose(config: DatabaseConfig, databaseUrl: string) {
    return `services:
  app:
    image: ghcr.io/jiujiu532/jovecanvas:latest
    network_mode: host
    volumes:
      - vozeb-pro-data:/app/web/.data
    environment:
      VOZEB_PRO_DATABASE_PROVIDER: "postgres"
      DATABASE_URL: ${quoteYaml(databaseUrl)}
      VOZEB_PRO_DATABASE_SSL: "0"
      VOZEB_PRO_ENCRYPTION_KEY: ${quoteYaml(config.encryptionKey)}
      VOZEB_PRO_TRUSTED_PROXY_HOPS: "1"
    restart: unless-stopped

volumes:
  vozeb-pro-data:`;
}

function buildPostgresUrl(input: { username: string; password: string; host: string; port: string; database: string }) {
    return `postgres://${encodeURIComponent(input.username)}:${encodeURIComponent(input.password)}@${input.host}:${input.port}/${encodeURIComponent(input.database)}`;
}

function quoteYaml(value: string) {
    return JSON.stringify(value);
}

function shellArg(value: string) {
    return /^[a-zA-Z0-9._:/-]+$/.test(value) ? value : `'${value.replace(/'/g, "'\"'\"'")}'`;
}

function sqlIdentifier(value: string) {
    return `"${value.replace(/"/g, '""')}"`;
}

function sqlLiteral(value: string) {
    return `'${value.replace(/'/g, "''")}'`;
}
