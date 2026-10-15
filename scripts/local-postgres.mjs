import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
const databaseDir = "./.local-postgres";
const postgres = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "postgres",
  port: 54322,
  persistent: true,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: (message) => {
    if (String(message).includes("FATAL")) console.error(String(message));
  },
});
if (!existsSync(`${databaseDir}/PG_VERSION`)) await postgres.initialise();
await postgres.start();
const client = postgres.getPgClient();
await client.connect();
const { rows } = await client.query(
  "SELECT 1 FROM pg_database WHERE datname = 'toga'",
);
if (!rows.length) await client.query("CREATE DATABASE toga");
await client.end();
console.log("Local Postgres ready on 127.0.0.1:54322 (database: toga).");
const stop = async () => {
  await postgres.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 60000);
