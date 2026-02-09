#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";
import {
  ClickHouseDataGenerator,
  type DataGenerator,
  formatDuration,
  PostgresDataGenerator,
  type Scenario,
  SQLiteDataGenerator,
  TrinoDataGenerator,
} from "./generator/index.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    // Database selection
    sqlite: { type: "boolean", default: false },
    postgres: { type: "boolean", default: false },
    clickhouse: { type: "boolean", default: false },
    trino: { type: "boolean", default: false },

    // Common options
    rows: { type: "string", short: "r" },
    batch: { type: "string", short: "b" },
    drop: { type: "boolean", default: false },
    truncate: { type: "boolean", default: false },

    // SQLite options
    "sqlite-path": { type: "string", default: "data/samples.db" },

    // PostgreSQL options
    "pg-host": { type: "string", default: "localhost" },
    "pg-port": { type: "string", default: "5432" },
    "pg-database": { type: "string", default: "appdb" },
    "pg-user": { type: "string", default: "postgres" },
    "pg-password": { type: "string", default: "postgres" },

    // ClickHouse options
    "ch-host": { type: "string", default: "localhost" },
    "ch-port": { type: "string", default: "8123" },
    "ch-database": { type: "string", default: "default" },
    "ch-user": { type: "string", default: "default" },
    "ch-password": { type: "string", default: "clickhouse" },

    // Trino options
    "trino-host": { type: "string", default: "localhost" },
    "trino-port": { type: "string", default: "8080" },
    "trino-user": { type: "string", default: "trino" },
    "trino-catalog": { type: "string", default: "iceberg" },
    "trino-schema": { type: "string", default: "warehouse" },

    // Help
    help: { type: "boolean", short: "h", default: false },
    version: { type: "boolean", short: "v", default: false },
  },
});

function printHelp(): void {
  console.log(`
samples-generation - Generate sample data for multiple databases

Usage:
  npx @mkven/samples-generation <scenario.json> [options]
  samples-generation <scenario.json> [options]

Arguments:
  scenario.json          Path to JSON file containing the scenario configuration

Database Selection (at least one required):
  --sqlite               Generate for SQLite
  --postgres             Generate for PostgreSQL
  --clickhouse           Generate for ClickHouse
  --trino                Generate for Trino (Iceberg)

Common Options:
  -r, --rows <count>     Override row count from scenario (supports 1_000_000 format)
  -b, --batch <size>     Batch size for generation (e.g., 100_000_000)
  --drop                 Drop tables before generating (default: false)
  --truncate             Truncate tables before generating (default: false)

SQLite Options:
  --sqlite-path <path>   SQLite database path (default: data/samples.db)

PostgreSQL Options:
  --pg-host <host>       PostgreSQL host (default: localhost)
  --pg-port <port>       PostgreSQL port (default: 5432)
  --pg-database <db>     PostgreSQL database (default: appdb)
  --pg-user <user>       PostgreSQL user (default: postgres)
  --pg-password <pass>   PostgreSQL password (default: postgres)

ClickHouse Options:
  --ch-host <host>       ClickHouse host (default: localhost)
  --ch-port <port>       ClickHouse port (default: 8123)
  --ch-database <db>     ClickHouse database (default: default)
  --ch-user <user>       ClickHouse user (default: default)
  --ch-password <pass>   ClickHouse password (default: clickhouse)

Trino Options:
  --trino-host <host>    Trino host (default: localhost)
  --trino-port <port>    Trino port (default: 8080)
  --trino-user <user>    Trino user (default: trino)
  --trino-catalog <cat>  Trino catalog (default: iceberg)
  --trino-schema <sch>   Trino schema (default: warehouse)

Other:
  -h, --help             Show this help message
  -v, --version          Show version

Examples:
  # Generate 10,000 rows in PostgreSQL
  npx @mkven/samples-generation scenario.json --postgres -r 10000

  # Generate in Trino with custom connection
  npx @mkven/samples-generation scenario.json --trino --trino-host db.example.com

  # Generate in multiple databases
  npx @mkven/samples-generation scenario.json --postgres --clickhouse --drop

Scenario File Format:
  The scenario file should be a JSON file with the following structure:
  {
    "name": "My scenario",
    "steps": [
      {
        "table": {
          "name": "users",
          "columns": [
            { "name": "id", "type": "bigint", "generator": { "kind": "sequence" } },
            { "name": "name", "type": "string", "generator": { "kind": "randomString", "length": 10 } }
          ]
        },
        "rowCount": 1000
      }
    ]
  }

  See documentation for full schema: https://github.com/making-ventures/samples-generation
`);
}

function printVersion(): void {
  // Read version from package.json at runtime
  const packageJsonPath = new URL("../package.json", import.meta.url);
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    console.log(`samples-generation v${packageJson.version}`);
  } catch {
    console.log("samples-generation (version unknown)");
  }
}

function loadScenario(filePath: string): Scenario {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: Scenario file not found: ${absolutePath}`);
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(absolutePath, "utf-8");
    return JSON.parse(content) as Scenario;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Error parsing scenario file: ${message}`);
    process.exit(1);
  }
}

function createGenerator(db: string): DataGenerator {
  switch (db) {
    case "sqlite":
      return new SQLiteDataGenerator({
        path: values["sqlite-path"] ?? "data/samples.db",
      });
    case "postgres":
      return new PostgresDataGenerator({
        host: values["pg-host"] ?? "localhost",
        port: Number.parseInt(values["pg-port"] ?? "5432", 10),
        database: values["pg-database"] ?? "appdb",
        username: values["pg-user"] ?? "postgres",
        password: values["pg-password"] ?? "postgres",
      });
    case "clickhouse":
      return new ClickHouseDataGenerator({
        host: values["ch-host"] ?? "localhost",
        port: Number.parseInt(values["ch-port"] ?? "8123", 10),
        database: values["ch-database"] ?? "default",
        username: values["ch-user"] ?? "default",
        password: values["ch-password"] ?? "clickhouse",
      });
    case "trino":
      return new TrinoDataGenerator({
        host: values["trino-host"] ?? "localhost",
        port: Number.parseInt(values["trino-port"] ?? "8080", 10),
        user: values["trino-user"] ?? "trino",
        catalog: values["trino-catalog"] ?? "iceberg",
        schema: values["trino-schema"] ?? "warehouse",
      });
    default:
      throw new Error(`Unknown database: ${db}`);
  }
}

async function runGeneration(
  db: string,
  scenario: Scenario,
  rowOverride: number | undefined,
  batchSize: number | undefined
): Promise<void> {
  const generator = createGenerator(db);
  const dbName = db.charAt(0).toUpperCase() + db.slice(1);

  console.log(`\n=== ${dbName} ===`);

  try {
    await generator.connect();
    console.log(`Connected to ${dbName}`);

    // Override row counts if specified
    const scenarioWithOverride: Scenario = rowOverride
      ? {
          ...scenario,
          steps: scenario.steps.map((step) =>
            "table" in step && "rowCount" in step
              ? { ...step, rowCount: rowOverride }
              : step
          ),
        }
      : scenario;

    const result = await generator.runScenario({
      scenario: scenarioWithOverride,
      dropFirst: values.drop,
      truncateFirst: values.truncate,
      batchSize,
    });

    // Log results for each step
    for (const step of result.steps) {
      if (step.generate) {
        console.log(
          `[${step.tableName}] Generated ${step.generate.rowsInserted.toLocaleString()} rows in ${formatDuration(step.generate.generateMs)}`
        );
      }
      if (step.transform) {
        console.log(
          `[${step.tableName}] Applied ${String(step.transform.batchesApplied)} transformation batch(es) in ${formatDuration(step.transform.durationMs)}`
        );
      }
    }

    console.log(
      `Total: ${result.totalRowsInserted.toLocaleString()} rows in ${formatDuration(result.durationMs)} (generation: ${formatDuration(result.generateMs)}, transformation: ${formatDuration(result.transformMs)}, optimize: ${formatDuration(result.optimizeMs)})`
    );

    // Verify row counts and show sample for each unique table
    const uniqueTables = [...new Set(result.steps.map((s) => s.tableName))];
    for (const tableName of uniqueTables) {
      const count = await generator.countRows(tableName);
      const size = await generator.getTableSizeForHuman(tableName);
      console.log(
        `[${tableName}] Verified: ${count.toLocaleString()} rows${size ? `, ${size}` : ""}`
      );
      const rows = await generator.queryRows(tableName, 1);
      if (rows.length > 0) {
        console.log(`[${tableName}] Sample:`, rows[0]);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Error with ${dbName}: ${message}`);
    process.exitCode = 1;
  } finally {
    await generator.disconnect();
  }
}

async function main(): Promise<void> {
  if (values.help) {
    printHelp();
    process.exit(0);
  }

  if (values.version) {
    printVersion();
    process.exit(0);
  }

  // Check for scenario file
  const scenarioFile = positionals[0];
  if (!scenarioFile) {
    console.error("Error: No scenario file specified");
    console.error(
      "Usage: npx @mkven/samples-generation <scenario.json> [options]"
    );
    console.error("Run with --help for more information");
    process.exit(1);
  }

  // Check for database selection
  const selectedDbs: string[] = [];
  if (values.sqlite) selectedDbs.push("sqlite");
  if (values.postgres) selectedDbs.push("postgres");
  if (values.clickhouse) selectedDbs.push("clickhouse");
  if (values.trino) selectedDbs.push("trino");

  if (selectedDbs.length === 0) {
    console.error("Error: No database selected");
    console.error(
      "Specify at least one: --sqlite, --postgres, --clickhouse, --trino"
    );
    process.exit(1);
  }

  // Load scenario
  const scenario = loadScenario(scenarioFile);
  console.log(`Scenario: ${scenario.name ?? scenarioFile}`);

  // Parse row override
  const rowOverride = values.rows
    ? Number.parseInt(values.rows.replace(/_/g, ""), 10)
    : undefined;

  if (rowOverride) {
    console.log(`Row count override: ${rowOverride.toLocaleString()}`);
  }

  // Parse batch size
  const batchSize = values.batch
    ? Number.parseInt(values.batch.replace(/_/g, ""), 10)
    : undefined;

  if (batchSize) {
    console.log(`Batch size: ${batchSize.toLocaleString()}`);
  }

  // Run generation for each selected database
  for (const db of selectedDbs) {
    await runGeneration(db, scenario, rowOverride, batchSize);
  }

  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
