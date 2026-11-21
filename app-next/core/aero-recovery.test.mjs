import assert from "node:assert/strict";
import { randomUUID, webcrypto } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import * as execution from "../../supabase/functions/aero-execute/protocol.mjs";
import * as memory from "../../supabase/functions/aero-memory/protocol.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(resolve(process.env.AERO_TEST_PGLITE_DIR, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const sql = name => readFileSync(join(root, name), "utf8");
const migrationDir = "supabase/migrations";
const migrations = readdirSync(join(root, migrationDir)).filter(name => name.endsWith(".sql")).sort();
const reconciliation = migrations.find(name => name.includes("_aero_certificate_reconciliation"));

const accountId = "11111111-1111-4111-8111-111111111111";
const otherAccount = "11111111-1111-4111-8111-222222222222";
const owner = { id: accountId };
const approvalExpiry = () => new Date(Date.now() + 120_000).toISOString();

function storage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    key: index => [...values.keys()][index],
    get length() { return values.size; },
    recoveryEntries: () => [...values].filter(([key]) => key.startsWith("altpsi.aero.pending.v1:")),
  };
}

async function browser(cloud, localStorage) {
  const window = { LyfeCloud: cloud };
  const sandbox = vm.createContext({ window, localStorage, crypto: webcrypto, setTimeout, clearTimeout });
  for (const script of [
    "app/aero-eval.js", "app/aero-core.js", "app/aero-harness.js", "app-next/core/attention.js",
    "app-next/core/store.js", "app-next/core/aero.js", "app-next/ui/views.js",
  ]) {
    vm.runInContext(sql(script), sandbox, { filename: script });
  }
  await window.AeroStore.boot();
  return { aero: window.AeroService, store: window.AeroStore, views: window.AeroViews };
}

async function setup() {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(
    "create schema auth; create schema extensions;" +
    "create role anon; create role authenticated; create role service_role bypassrls;" +
    "create table auth.users (id uuid primary key);" +
    "create function auth.uid() returns uuid language sql stable as $$ select current_setting('request.jwt.claim.sub', true)::uuid $$;" +
    "create publication supabase_realtime;"
  );
  for (const name of ["profiles", "posts", "comments", "relationships", "workspaces", "workspace_members", "pages", "channels", "messages", "opportunities", "applications", "notifications"]) {
    // The unrelated Connect tables exist in production. Their only use here
    // is as the targets of the execution migration's privilege revocation.
    await db.exec("create table public.connect_" + name + " (id integer);");
  }
  await db.exec(sql("app/schema.sql"));
  for (const migration of migrations.filter(name => name !== reconciliation)) {
    await db.exec(sql(join(migrationDir, migration)));
  }
  await db.query("insert into auth.users values ($1), ($2)", [accountId, otherAccount]);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [accountId]);
  return db;
}

function backend(db) {
  const calls = { workspace: 0, memory: 0, cancel: 0, prepare: 0, push: 0 };
  const preparedById = new Map();
  const fault = { network: true, commit: null, afterInspect: null, beforePush: null };
  const jsonb = value => JSON.stringify(value);

  async function rpc(name, args) {
    const query = "select public." + name + "(" + args.map((_, index) => "$" + (index + 1)).join(", ") + ") as result";
    const value = (await db.query(query, args)).rows[0].result;
    if (!value.ok && value.applied === undefined) throw Object.assign(new Error(value.error), { code: value.error });
    return value;
  }

  function online() {
    if (!fault.network) throw new TypeError("Network response unavailable");
  }

  async function readWorkspace() {
    const { rows } = await db.query("select data, rev::integer as rev from lyfe_states where user_id = $1", [accountId]);
    return rows[0] || null;
  }

  async function readMemory() {
    const current = await rpc("aero_read_memory_state", [accountId]);
    const state = memory.normalizeState(current.state);
    const stateDigest = await memory.digestValue(state);
    if (current.canonicalDigestBound !== true) await rpc("aero_bind_memory_canonical_digest", [accountId, current.revision, stateDigest]);
    return { state, stateDigest, revision: current.revision };
  }

  async function commit(kind, payload, hashToken) {
    calls[kind] += 1;
    const id = payload.runId || payload.transactionId;
    const fn = kind === "memory" ? "aero_commit_memory_transaction" : "aero_commit_run";
    const tokenHash = await hashToken(payload.approvalToken);
    const apply = () => rpc(fn, [accountId, id, payload.contractDigest, tokenHash, null]);
    return fault.commit ? fault.commit(apply) : apply();
  }

  async function inspect(kind, id) {
    online();
    const fn = kind === "memory" ? "aero_inspect_memory_transaction" : "aero_inspect_run";
    const result = await rpc(fn, [accountId, id]);
    return fault.afterInspect ? fault.afterInspect(result) : result;
  }

  async function push(data, rev, options) {
    online();
    assert.ok(Number.isSafeInteger(options.expectedRev));
    assert.equal(options.ownerId, accountId);
    calls.push += 1;
    if (fault.beforePush) await fault.beforePush(options);
    return rpc("lyfe_compare_and_swap_state", [options.expectedRev, jsonb(data)]);
  }

  const cloud = {
    user: owner, aeroExecutionEnabled: true, aeroMemoryEnabled: true,
    async init() { return "cloud"; },
    async pull() { online(); return readWorkspace(); },
    push,
    async prepareAeroRun({ requestKey, intent, actions }) {
      online();
      calls.prepare += 1;
      const current = await readWorkspace();
      const material = await execution.prepareRunMaterial({
        userId: accountId, requestKey, runId: randomUUID(), intent, actions, state: current.data, rev: current.rev,
      });
      const approvalToken = execution.randomToken();
      const approvalExpiresAt = approvalExpiry();
      const result = await rpc("aero_prepare_run", [
        material.runId, accountId, requestKey, jsonb(material.contract), material.contractDigest, material.baseRev,
        material.beforeDigest, jsonb(material.targetData), material.targetDigest, jsonb(material.patches),
        jsonb(material.review), await execution.hashToken(approvalToken), approvalExpiresAt,
      ]);
      preparedById.set(result.runId, result);
      return { ...result, approvalToken, approvalExpiresAt };
    },
    async prepareAeroMemory({ requestKey, operations }) {
      online();
      calls.prepare += 1;
      const current = await readMemory();
      const material = await memory.prepareMemoryMaterial({
        userId: accountId, requestKey, operations, ...current, authorityNow: 1_800_000_000_000,
      });
      if (material.noChange) return { ...current, ok: true, status: "noop" };
      const approvalToken = memory.randomToken();
      const approvalExpiresAt = approvalExpiry();
      const result = await rpc("aero_prepare_memory_transaction", [
        randomUUID(), accountId, requestKey, jsonb(material.operations), material.operationDigest, jsonb(material.contract),
        material.contractDigest, material.baseRevision, material.beforeDigest, jsonb(material.targetState),
        material.targetDigest, jsonb(material.review), await memory.hashToken(approvalToken), approvalExpiresAt,
      ]);
      preparedById.set(result.transactionId, result);
      return { ...result, approvalToken, approvalExpiresAt };
    },
    commitAeroRun(payload) { return commit("workspace", payload, execution.hashToken); },
    commitAeroMemory(payload) { return commit("memory", payload, memory.hashToken); },
    async cancelAeroRun({ runId, contractDigest }) {
      online();
      calls.cancel += 1;
      return rpc("aero_cancel_run", [accountId, runId, contractDigest]);
    },
    async cancelAeroMemory({ transactionId, contractDigest }) {
      online();
      calls.cancel += 1;
      return rpc("aero_cancel_memory_transaction", [accountId, transactionId, contractDigest]);
    },
    inspectAeroRun: id => inspect("workspace", id),
    inspectAeroMemory: id => inspect("memory", id),
    async readAeroMemory() { online(); return readMemory(); },
  };
  async function otherEdit(title) {
    const row = await readWorkspace();
    const data = { ...row.data, tasks: [...row.data.tasks, { id: randomUUID(), title, status: "open" }] };
    return rpc("lyfe_compare_and_swap_state", [row.rev, jsonb(data)]);
  }
  return { cloud, fault, calls, readWorkspace, readMemory, otherEdit, preparedById, rpc };
}

test("account actions recover across restart and respect the original approval", async t => {
  const db = await setup();
  t.after(() => db.close());
  const net = backend(db);
  const session = storage();
  let client = await browser(net.cloud, session);

  const review = await client.aero.propose("Create a task Verify release\nlog 1h on release checks");
  assert.equal(review.kind, "proposal");
  const stepCount = review.run.steps.length;
  assert.equal(stepCount, 2);
  await client.aero.prepare(review.run.id);
  const originalId = [...net.preparedById.keys()][0];
  const revisionAtReview = (await net.readWorkspace()).rev;
  const dispatches = () => net.calls.workspace + net.calls.memory;
  assert.equal(dispatches(), 0);
  assert.equal(session.recoveryEntries().length, 1);
  assert.doesNotMatch(session.recoveryEntries()[0][1], /Verify release|approvalToken|presenceToken/);

  client = await browser(net.cloud, session);
  await assert.rejects(() => client.aero.execute(review.run.id), /review again/);
  const resumed = await client.aero.prepare(review.run.id);
  assert.equal(resumed.authority, "server");
  assert.match(client.views.reviewPanel(resumed), /Apply 2 changes/);
  assert.equal((await net.readWorkspace()).rev, revisionAtReview, "re-review does not flush new state");
  assert.deepEqual([...net.preparedById.keys()], [originalId]);
  assert.equal(dispatches(), 0);

  net.fault.commit = async apply => {
    await apply();
    net.fault.network = false;
    throw new TypeError("Lost the response after database commit");
  };
  await assert.rejects(() => client.aero.execute(review.run.id), { code: "outcome_uncertain" });
  assert.equal(dispatches(), 1);
  assert.equal(client.aero.recoveryState(review.run.id).phase, "uncertain");
  const unresolved = client.views.receiptPanel({ run: client.aero.findRun(review.run.id), status: "uncertain" });
  assert.match(unresolved, /Outcome unconfirmed/);
  assert.match(unresolved, /Check status/);
  assert.doesNotMatch(unresolved, /No changes applied|Try again/);
  await assert.rejects(() => client.aero.execute(review.run.id), { code: "outcome_uncertain" });
  assert.equal(dispatches(), 1);
  const overlapping = client.aero.proposeActions("Create a task Verify release", [{ type: "add_task", title: "Verify release" }]);
  await assert.rejects(() => client.aero.prepare(overlapping.run.id), { code: "outcome_uncertain", runId: review.run.id });

  net.fault.network = true;
  net.fault.commit = null;
  const other = await browser({
    user: { id: otherAccount }, async init() { return "cloud"; }, async pull() { return null; },
  }, session);
  assert.equal(other.aero.recoveryState(review.run.id), null);
  assert.equal(other.aero.pendingRuns().length, 0);

  net.fault.afterInspect = record => ({
    ...record, events: record.events.map(entry => entry.type === "completed"
      ? { ...entry, payload: { ...entry.payload, targetDigest: "0".repeat(64) } } : entry),
  });
  assert.equal((await client.aero.reconcileRun(review.run.id)).status, "uncertain");
  net.fault.afterInspect = null;
  // A later unrelated edit can occur before the disconnected device returns.
  await net.otherEdit("Another device’s update");
  client = await browser(net.cloud, session);
  const [recovered] = await client.aero.reconcilePending();
  assert.equal(recovered.run.status, "completed");
  assert.equal(recovered.receipt.proof, "journal", "the deployed inspect RPC predates certificateValid");
  assert.equal(recovered.receiptSynced, true);
  assert.match(client.views.receiptPanel(recovered), /Verified after reconnect/);
  assert.equal(client.aero.recoveryState(review.run.id), null);
  assert.equal(dispatches(), 1);
  const account = await net.readWorkspace();
  assert.equal(account.data.tasks.filter(task => task.title === "Verify release").length, 1);
  assert.equal(account.data.worklog.length, 1);
  assert.equal(account.data.tasks.filter(task => task.title.includes("device’s update")).length, 1);
  await assert.rejects(() => client.aero.execute(review.run.id), /closed/i);
  assert.equal(dispatches(), 1);

  await db.exec(sql(join(migrationDir, reconciliation)));
  const inspected = await net.cloud.inspectAeroRun(originalId);
  assert.equal(inspected.certificateValid, true);
  await assert.rejects(() => net.rpc("aero_inspect_run", [otherAccount, originalId]), { code: "run_not_found" });
  await db.query("update aero_private.aero_runs set completion_certificate = jsonb_set(completion_certificate, '{digest}', to_jsonb(repeat('f', 64))) where id = $1", [originalId]);
  assert.equal((await net.cloud.inspectAeroRun(originalId)).certificateValid, false);
});

test("cancellation fences a late commit and duplicate approval does not dispatch again", async t => {
  const db = await setup();
  t.after(() => db.close());
  const net = backend(db);
  const session = storage();
  const client = await browser(net.cloud, session);
  const proposal = client.aero.proposeActions("Create a task late arrival", [{ type: "add_task", title: "late arrival" }]);
  await client.aero.prepare(proposal.run.id);
  const write = session.setItem;
  session.setItem = () => { throw new Error("Storage unavailable"); };
  await assert.rejects(() => client.aero.execute(proposal.run.id), { code: "recovery_storage_unavailable" });
  session.setItem = write;
  assert.equal(net.calls.workspace, 0);
  let lateCommit;
  net.fault.commit = apply => {
    lateCommit = apply;
    throw new TypeError("Request delayed");
  };
  const [outcome, repeated] = await Promise.allSettled([
    client.aero.execute(proposal.run.id), client.aero.execute(proposal.run.id),
  ]);
  assert.equal(outcome.value.status, "cancelled");
  assert.equal(repeated.status, "rejected");
  assert.equal(net.calls.workspace, 1);
  await assert.rejects(lateCommit, { code: "run_not_prepared" });
  assert.equal((await net.readWorkspace()).data.tasks.length, 0);

  net.fault.commit = null;
  const stale = client.aero.proposeActions("Create a task stale review", [{ type: "add_task", title: "stale review" }]);
  await client.aero.prepare(stale.run.id);
  await net.otherEdit("Updated during review");
  const stopped = await client.aero.execute(stale.run.id);
  assert.equal(stopped.status, "stale");
  assert.match(client.views.receiptPanel(stopped), /Edit request/);
  const tasks = (await net.readWorkspace()).data.tasks;
  assert.equal(tasks.some(task => task.title === "stale review"), false);
  assert.equal(tasks.some(task => task.title === "Updated during review"), true);
});

test("memory uses the real closed protocol and receipt sync preserves a competing workspace update", async t => {
  const db = await setup();
  t.after(() => db.close());
  await db.exec(sql(join(migrationDir, reconciliation)));
  const net = backend(db);
  const session = storage();
  let client = await browser(net.cloud, session);
  const seed = client.aero.proposeActions("Create a task existing task", [{ type: "add_task", title: "existing task" }]);
  await client.aero.prepare(seed.run.id);
  await client.aero.execute(seed.run.id);

  const claim = "I prefer short test notes";
  const learned = await client.aero.propose("Remember that " + claim);
  assert.equal(learned.kind, "proposal");
  await client.aero.prepare(learned.run.id);
  net.fault.commit = async apply => {
    await apply();
    throw new TypeError("Lost the memory commit response");
  };
  net.fault.beforePush = async options => {
    if (!options.quietConflict) return;
    net.fault.beforePush = null;
    await net.otherEdit("Concurrent edit during receipt sync");
  };
  const outcome = await client.aero.execute(learned.run.id);
  assert.equal(outcome.receipt.proof, "certificate");
  assert.equal(outcome.receiptSynced, false);
  assert.equal(client.aero.recoveryState(learned.run.id).phase, "completed");
  assert.equal(net.calls.memory, 1);

  client = await browser(net.cloud, session);
  assert.equal((await client.aero.reconcilePending())[0].receiptSynced, true);
  const workspace = await net.readWorkspace();
  assert.equal(workspace.data.tasks.some(task => task.title.startsWith("Concurrent edit")), true);
  assert.doesNotMatch(JSON.stringify(workspace.data.aeroRuns.find(run => run.id === learned.run.id)), new RegExp(claim));
  assert.equal((await net.readMemory()).state.memories.some(item => item.claim === claim), true);

  net.fault.commit = null;
  const forget = await client.aero.propose("Forget that " + claim);
  await client.aero.prepare(forget.run.id);
  const forgetResult = await client.aero.execute(forget.run.id);
  assert.equal(forgetResult.run.status, "completed");
  assert.equal((await net.readMemory()).state.memories.some(item => item.claim === claim), false);
  assert.equal(net.calls.memory, 2);
});
