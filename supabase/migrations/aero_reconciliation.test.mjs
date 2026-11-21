import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const migrationName = fs.readdirSync(directory).find((name) => /_aero_certificate_reconciliation\.sql$/.test(name));
assert.ok(migrationName, "Aero certificate reconciliation migration is missing");
const sql = fs.readFileSync(path.join(directory, migrationName), "utf8");
const executionSql = fs.readFileSync(path.join(directory, fs.readdirSync(directory).find((name) => /_aero_execution_boundary\.sql$/.test(name))), "utf8");
const memorySql = fs.readFileSync(path.join(directory, fs.readdirSync(directory).find((name) => /_aero_server_owned_memory\.sql$/.test(name))), "utf8");

function functionBody(name, source = sql) {
  const pattern = new RegExp(`create or replace function ${name.replaceAll(".", "\\.")}\\([\\s\\S]*?\\n\\$\\$;`, "i");
  const match = source.match(pattern);
  assert.ok(match, `${name} is missing`);
  return match[0];
}

test("workspace inspection authenticates the stored completion certificate", () => {
  const inspect = functionBody("public.aero_inspect_run");
  assert.match(inspect, /'certificateValid', v_certificate_valid/i);
  assert.match(inspect, /digest\(\(v_run\.completion_certificate->'payload'\)::text, 'sha256'\)/i);
  assert.match(inspect, /payload'->>'runId' = v_run\.id::text/i);
  assert.match(inspect, /payload'->>'contractDigest' = v_run\.contract_digest/i);
  assert.match(inspect, /payload'->>'targetDigest' = v_run\.target_digest/i);
  assert.match(inspect, /payload'->>'eventHeadDigest' = v_run\.event_head_digest/i);
  assert.match(inspect, /payload'->>'newRev' = \(v_run\.base_rev \+ 1\)::text/i);
  assert.match(inspect, /aero_event_chain_valid/i);
  assert.match(inspect, /aero_payload_storage_digest/i);
});

test("commit and cancellation fence on the same owned row", () => {
  const runCommit = functionBody("public.aero_commit_run", executionSql);
  const runCancel = functionBody("public.aero_cancel_run", executionSql);
  assert.match(runCommit, /from aero_private\.aero_runs[\s\S]*?for update/i);
  assert.match(runCancel, /from aero_private\.aero_runs[\s\S]*?for update/i);

  const memoryCommit = functionBody("public.aero_commit_memory_transaction", memorySql);
  const memoryCancel = functionBody("public.aero_cancel_memory_transaction", memorySql);
  assert.match(memoryCommit, /from aero_private\.aero_memory_transactions[\s\S]*?for update/i);
  assert.match(memoryCancel, /from aero_private\.aero_memory_transactions[\s\S]*?for update/i);
});

test("memory inspection authenticates its independent completion certificate", () => {
  const inspect = functionBody("public.aero_inspect_memory_transaction");
  assert.match(inspect, /'certificateValid', v_certificate_valid/i);
  assert.match(inspect, /digest\(\(v_transaction\.completion_certificate->'payload'\)::text, 'sha256'\)/i);
  assert.match(inspect, /payload'->>'transactionId' = v_transaction\.id::text/i);
  assert.match(inspect, /payload'->>'contractDigest' = v_transaction\.contract_digest/i);
  assert.match(inspect, /payload'->>'targetDigest' = v_transaction\.target_digest/i);
  assert.match(inspect, /payload'->>'eventHeadDigest' = v_transaction\.event_head_digest/i);
  assert.match(inspect, /payload'->>'newRevision' = \(v_transaction\.base_revision \+ 1\)::text/i);
  assert.match(inspect, /aero_memory_event_chain_valid/i);
  assert.match(inspect, /aero_memory_tx_storage_digest/i);
});

test("inspection remains read-only and grants no new dispatch authority", () => {
  for (const name of ["public.aero_inspect_run", "public.aero_inspect_memory_transaction"]) {
    const inspect = functionBody(name);
    assert.doesNotMatch(inspect, /update\s|insert\s|delete\s|approval_token_hash\s*=/i);
    assert.doesNotMatch(inspect, /security definer/i);
    assert.match(inspect, /security invoker/i);
  }
});
