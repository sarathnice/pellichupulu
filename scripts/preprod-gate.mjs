import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const startedAt = new Date();
const steps = [];

const workerEnv = process.env.WORKER_ENV || "staging";
const d1Database = process.env.D1_DATABASE || "pellichupulu-staging";
const reportLabel = process.env.GATE_LABEL || workerEnv.toUpperCase();

const env = {
  ...process.env,
  STAGING_API_URL: process.env.STAGING_API_URL || "https://pellichupulu-api-staging.sarathnice.workers.dev",
  TURNSTILE_BYPASS_TOKEN: process.env.TURNSTILE_BYPASS_TOKEN || "PEL_STAGING_BYPASS_2026"
};

function nowIso() {
  return new Date().toISOString();
}

function runStep(label, command) {
  const stepStartedAt = Date.now();
  console.log(`\n=== ${label} ===`);
  console.log(command);

  const result = spawnSync(command, {
    shell: true,
    stdio: "inherit",
    env
  });

  const ok = result.status === 0;
  steps.push({
    label,
    command,
    ok,
    durationMs: Date.now() - stepStartedAt
  });

  if (!ok) {
    throw new Error(`Step failed: ${label}`);
  }
}

function writeReport(status, errorMessage = "") {
  const outputsDir = path.resolve("outputs");
  mkdirSync(outputsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(outputsDir, `preprod-gate-report-${stamp}.md`);

  const rows = steps.map((step, index) => {
    const seconds = (step.durationMs / 1000).toFixed(1);
    return `${index + 1}. ${step.ok ? "PASS" : "FAIL"} - ${step.label} (${seconds}s)`;
  }).join("\n");

  const content = [
    `# ${reportLabel} Gate Report`,
    "",
    `- Status: ${status}`,
    `- Started: ${startedAt.toISOString()}`,
    `- Finished: ${nowIso()}`,
    `- Worker env: ${workerEnv}`,
    `- D1 database: ${d1Database}`,
    `- API URL: ${env.STAGING_API_URL}`,
    "",
    "## Step Results",
    rows || "No steps executed.",
    "",
    "## Notes",
    "- This gate validates deploy + schema + seed + smoke scenarios before production promotion.",
    "- If this report is FAIL, do not proceed to production.",
    errorMessage ? `- Failure: ${errorMessage}` : "- No failures detected.",
    ""
  ].join("\n");

  writeFileSync(reportPath, content, "utf8");
  console.log(`\nReport written: ${reportPath}`);
}

function main() {
  try {
    const deployCmd = workerEnv === "production" ? "npx wrangler deploy" : `npx wrangler deploy --env ${workerEnv}`;

    runStep(`Deploy ${workerEnv} worker`, deployCmd);
    runStep(`Apply ${workerEnv} schema`, `npx wrangler d1 execute ${d1Database} --remote --file=./schema.sql --yes`);
    runStep(`Seed ${workerEnv} data`, `npx wrangler d1 execute ${d1Database} --remote --file=./seed.sql --yes`);
    runStep(`Ensure ${workerEnv} admin`, `npx wrangler d1 execute ${d1Database} --remote --file=./scripts/ensure-staging-admin.sql --yes`);
    runStep("Apply AI cost controls migration", `npx wrangler d1 execute ${d1Database} --remote --file=./migrations/2026-05-01-ai-cost-controls.sql --yes`);
    runStep(`Clear ${workerEnv} auth rate limits`, `npx wrangler d1 execute ${d1Database} --remote --command \"DELETE FROM auth_rate_limits;\" --yes`);
    runStep(`Run ${workerEnv} smoke scenarios`, "node ./scripts/staging-smoke-test.mjs");

    writeReport("PASS");
    console.log(`\n${reportLabel} GATE PASSED`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeReport("FAIL", message);
    console.error(`\n${reportLabel} GATE FAILED`);
    console.error(message);
    process.exit(1);
  }
}

main();
