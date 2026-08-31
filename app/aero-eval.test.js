"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

global.window = {};
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "aero-harness.js"), "utf8"), {
  filename: "aero-harness.js",
});
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "aero-eval.js"), "utf8"), {
  filename: "aero-eval.js",
});

const Eval = window.AeroEval;
assert.ok(Eval, "Aero Eval should load");
const SALT = "test-only-private-study-salt";
const AUTHORITY_ID = "11111111-1111-4111-8111-111111111111";
const CERTIFICATE_DIGEST = "a".repeat(64);

const taskKey = Eval.routineKeyForActions([{ type: "add_task", title: "Email Professor", due: "2026-09-01" }], SALT);
assert.match(taskKey, /^routine-[0-9a-f]{64}$/);
assert.ok(!taskKey.includes("professor"), "routine keys must not expose prompt content");
assert.equal(taskKey, Eval.routineKeyForActions([{ type: "add_task", title: "Email Professor tomorrow", due: "2026-09-02" }], SALT));
assert.notEqual(taskKey, Eval.routineKeyForActions([{ type: "add_task", title: "Call Mum tomorrow" }], SALT));
assert.notEqual(taskKey, Eval.routineKeyForActions([{ type: "add_note", title: "Email Professor" }], SALT));
assert.equal(Eval.routineKeyForActions([{ type: "add_task", title: "Email Professor" }]), "", "routine keys require a private salt");

const AT = Date.UTC(2026, 7, 1, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1_000;

function study(key, phase, overrides = {}) {
  return {
    taskKey: key,
    kind: "action",
    phase,
    verification: "environment",
    authorityId: AUTHORITY_ID,
    certificateDigest: CERTIFICATE_DIGEST,
    expectedConstraints: 1,
    satisfiedConstraints: 1,
    ...overrides,
  };
}

function receiptFor(id) {
  const digest = window.AeroHarness.digestValue({ id }).replace(/^sha256-/, "");
  return {
    authorityId: `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`,
    certificateDigest: digest,
  };
}

function trial(id, key, phase, wordCount, createdAt, overrides = {}) {
  return {
    id,
    study: study(key, phase, { ...receiptFor(id), ...overrides.study }),
    outcome: overrides.outcome || "accepted",
    wordCount,
    createdAt,
  };
}

const cleanStudy = [];
for (let routine = 0; routine < 12; routine += 1) {
  const key = Eval.routineKeyForActions([{ type: "add_task", title: `Routine ${routine}` }], SALT);
  cleanStudy.push(trial(`base-${routine}`, key, "baseline", 12, AT));
  for (let repeat = 0; repeat < 3; repeat += 1) {
    const offset = ((routine + repeat) % 7) + 1;
    cleanStudy.push(trial(`adapted-${routine}-${repeat}`, key, "adapted", 3, AT + offset * DAY));
  }
}

const report = Eval.evaluate(cleanStudy);
assert.equal(report.releasePairs, 36);
assert.equal(report.taskKeys, 12);
assert.equal(report.minimumRepeatsPerRoutine, 3);
assert.equal(report.distinctDays, 8);
assert.equal(report.compression, 0.75);
assert.equal(report.intentAccuracyDelta, 0);
assert.equal(report.constraintConsistency, 1);
assert.ok(report.adaptedAccuracyLower95 > 0.9);
assert.ok(report.routineReliabilityLower95 > 0.8);
assert.equal(report.status, "release-evidence");
assert.equal(report.evidenceReady, true);

const misses = cleanStudy.map(item => JSON.parse(JSON.stringify(item)));
for (let index = 0; index < 4; index += 1) {
  const miss = misses.find(item => item.id === `adapted-${index}-0`);
  miss.outcome = "rejected";
  miss.study.verification = "user";
  miss.study.satisfiedConstraints = 0;
}
const missReport = Eval.evaluate(misses);
assert.ok(missReport.compression > 0.7, "short prompts may still look compressed");
assert.equal(missReport.evidenceReady, false, "compression cannot hide intent failures");
assert.ok(missReport.intentAccuracyDelta < -0.05);
assert.ok(missReport.gates.some(gate => gate.id === "accuracy-non-inferiority" && !gate.pass));
assert.ok(missReport.gates.some(gate => gate.id === "routine-confidence" && !gate.pass));

const imbalanced = cleanStudy.filter(item => item.id === "base-0" || item.id.startsWith("adapted-0-"));
for (let routine = 1; routine < 12; routine += 1) {
  imbalanced.push(cleanStudy.find(item => item.id === `base-${routine}`));
  imbalanced.push(cleanStudy.find(item => item.id === `adapted-${routine}-0`));
}
for (let repeat = 3; repeat < 25; repeat += 1) {
  const key = imbalanced[0].study.taskKey;
  imbalanced.push(trial(`imbalanced-0-${repeat}`, key, "adapted", 1, AT + ((repeat % 7) + 1) * DAY));
}
const imbalancedReport = Eval.evaluate(imbalanced);
assert.ok(imbalancedReport.releasePairs >= 30, "one routine can supply plenty of raw pairs");
assert.equal(imbalancedReport.evidenceReady, false, "one heavily repeated routine cannot fund the whole claim");
assert.equal(imbalancedReport.underSampledRoutines, 11);
assert.ok(imbalancedReport.gates.some(gate => gate.id === "routine-repeats" && !gate.pass));

const stale = cleanStudy.map(item => JSON.parse(JSON.stringify(item)));
stale.find(item => item.id === "adapted-0-0").study.stalePreferenceViolation = true;
const staleReport = Eval.evaluate(stale);
assert.equal(staleReport.evidenceReady, false);
assert.equal(staleReport.stalePreferenceViolations, 1);
assert.ok(staleReport.gates.some(gate => gate.id === "stale-state" && !gate.pass));

const replayed = cleanStudy.map(item => JSON.parse(JSON.stringify(item)));
replayed[1].study.authorityId = replayed[0].study.authorityId;
replayed[1].study.certificateDigest = replayed[0].study.certificateDigest;
const replayReport = Eval.evaluate(replayed);
assert.equal(replayReport.duplicateReceipts, 1);
assert.equal(replayReport.evidenceReady, false, "one completion receipt cannot fund two study trials");
assert.ok(replayReport.gates.some(gate => gate.id === "unique-evidence" && !gate.pass));

const duplicateIdReport = Eval.evaluate(cleanStudy.concat(JSON.parse(JSON.stringify(cleanStudy[0]))));
assert.equal(duplicateIdReport.duplicateTrialIds, 1);
assert.equal(duplicateIdReport.evidenceReady, false, "one episode cannot be replayed as extra evidence");

const localOnly = [
  trial("local-base", "study-local", "baseline", 10, AT, { study: { verification: "local" } }),
  trial("local-repeat", "study-local", "adapted", 2, AT + DAY, { study: { verification: "local" } }),
];
const localReport = Eval.evaluate(localOnly);
assert.equal(localReport.directionalPairs, 1);
assert.equal(localReport.releasePairs, 0, "same-process success is directional, not release evidence");
assert.equal(localReport.status, "directional");

const burden = [
  trial("burden-base", Eval.routineKeyForActions([{ type: "add_task", title: "Burden routine" }], SALT), "baseline", 10, AT),
  trial("burden-repeat", Eval.routineKeyForActions([{ type: "add_task", title: "Burden routine" }], SALT), "adapted", 2, AT + DAY, {
    study: { followupWords: 8, clarificationTurns: 1 },
  }),
];
const burdenReport = Eval.evaluate(burden, { minimumPairs: 1, minimumTasks: 1, minimumDays: 1 });
assert.equal(burdenReport.compression, 0, "clarification words belong in communication cost");
assert.equal(burdenReport.adaptedFirstPassRate, 0, "a clarification is successful but not first-pass intent resolution");

const synthetic = [
  trial("synthetic-base", Eval.routineKeyForActions([{ type: "add_task", title: "Synthetic routine" }], SALT), "baseline", 10, AT, { study: { verification: "synthetic", synthetic: true } }),
  trial("synthetic-repeat", Eval.routineKeyForActions([{ type: "add_task", title: "Synthetic routine" }], SALT), "adapted", 2, AT + DAY, { study: { verification: "synthetic", synthetic: true } }),
];
const syntheticReport = Eval.evaluate(synthetic);
assert.equal(syntheticReport.releasePairs, 0, "synthetic trials can test code but cannot prove a human outcome");

const episodes = [
  { id: "episode-1", signal: "private words are never exported", wordCount: 6, outcome: "accepted", createdAt: AT, study: study("study-import", "baseline") },
  { id: "episode-2", signal: "same", wordCount: 1, outcome: "accepted", createdAt: AT + DAY, study: study("study-import", "adapted") },
];
const imported = Eval.fromEpisodes(episodes);
assert.equal(imported.length, 2);
assert.ok(!JSON.stringify(imported).includes("private words"), "evaluation rows must not copy prompt text");

const inferredBaseline = [];
const firstStudy = Eval.studyForAction({ actions: [{ type: "add_task", title: "Weekly review" }], applied: 1, execution: "server-atomic", episodes: inferredBaseline, salt: SALT, authorityId: AUTHORITY_ID, certificateDigest: CERTIFICATE_DIGEST });
assert.equal(firstStudy.phase, "baseline");
const repeatedStudy = Eval.studyForAction({
  actions: [{ type: "add_task", title: "Weekly review next week" }],
  applied: 1,
  execution: "server-atomic",
  episodes: [{ outcome: "accepted", study: firstStudy }],
  salt: SALT,
  authorityId: AUTHORITY_ID,
  certificateDigest: CERTIFICATE_DIGEST,
});
assert.equal(repeatedStudy.phase, "adapted");
assert.equal(repeatedStudy.taskKey, firstStudy.taskKey);

const firstVerifiedAfterLocal = Eval.studyForAction({
  actions: [{ type: "add_task", title: "Weekly review" }],
  applied: 1,
  execution: "server-atomic",
  episodes: [{ outcome: "accepted", study: { ...firstStudy, verification: "local" } }],
  salt: SALT,
  authorityId: AUTHORITY_ID,
  certificateDigest: CERTIFICATE_DIGEST,
});
assert.equal(firstVerifiedAfterLocal.phase, "baseline", "local success cannot become a production study baseline");

const afterRejectedBaseline = Eval.studyForAction({
  actions: [{ type: "add_task", title: "Weekly review" }],
  applied: 1,
  execution: "server-atomic",
  episodes: [{ outcome: "rejected", study: { ...firstStudy, verification: "local", authorityId: "", certificateDigest: "" } }],
  salt: SALT,
  authorityId: AUTHORITY_ID,
  certificateDigest: CERTIFICATE_DIGEST,
});
assert.equal(afterRejectedBaseline.phase, "adapted", "a rejected first attempt must remain the production baseline");

const unboundReceipt = Eval.studyForAction({
  actions: [{ type: "add_task", title: "Weekly review" }],
  applied: 1,
  execution: "server-atomic",
  episodes: [],
  salt: SALT,
});
assert.equal(unboundReceipt.verification, "local", "a server label without a certificate receipt is not environment evidence");

const indexHtml = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
assert.ok(indexHtml.indexOf("aero-harness.js") < indexHtml.indexOf("aero-eval.js"), "the SHA-256 harness must load before evaluation");
assert.ok(indexHtml.indexOf("aero-eval.js") < indexHtml.indexOf("app.js"), "evaluation must load before product instrumentation");
const worker = fs.readFileSync(path.join(__dirname, "sw.js"), "utf8");
assert.match(worker, /aero-eval\.js\?v=aero-core-2/, "the offline shell must include the evaluator");
const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
assert.match(app, /aeroStudySalt/, "the product must keep a private sync-stable routine salt");
assert.match(app, /result\.certificate && result\.certificate\.digest/, "production study rows must originate from completion receipts");

console.log("Aero longitudinal evaluation v0.2 checks passed");
