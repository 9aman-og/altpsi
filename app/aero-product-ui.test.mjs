import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(directory, "app.js"), "utf8");
const index = fs.readFileSync(path.join(directory, "index.html"), "utf8");
const worker = fs.readFileSync(path.join(directory, "sw.js"), "utf8");

test("the daily Aero surface behaves like a product, not an architecture explainer", () => {
  const view = app.match(/function viewSol\(\) \{[\s\S]*?\n\}/)?.[0] || "";

  assert.match(view, /<h1>Aero<\/h1>/);
  assert.match(view, /What can I help with\?/);
  assert.match(view, /Context &amp; memory/);
  assert.match(view, /data-action="aero-add-image"/);
  assert.match(view, /data-action="aero-voice"/);
  assert.match(view, /id="aero-project-select"/);

  assert.doesNotMatch(view, /Ready when you are/);
  assert.doesNotMatch(view, /Your work and context, shaped/);
  assert.doesNotMatch(view, /Nothing changes without your review/);
  assert.doesNotMatch(view, /GETTING EASIER|AVAILABLE CONTEXT|WHAT AERO KNOWS/);
});

test("a new chat opens cleanly without scripted assistant exposition", () => {
  const firstRun = app.match(/function firstRunData\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  const createThread = app.match(/function createAeroThread\(projectId, title\) \{[\s\S]*?\n\}/)?.[0] || "";

  assert.doesNotMatch(firstRun, /d\.chat\.push/);
  assert.doesNotMatch(createThread, /state\.data\.chat\.push/);
  assert.match(app, /seededAeroIntros/);
  assert.match(app, /seededThreadPrompts/);
});

test("the offline shell uses the same versioned product assets as the page", () => {
  const style = index.match(/styles\.css\?v=[^"']+/)?.[0];
  const script = index.match(/app\.js\?v=[^"']+/)?.[0];

  assert.ok(style, "the page should version its stylesheet");
  assert.ok(script, "the page should version its product script");
  assert.match(worker, new RegExp(style.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(worker, new RegExp(script.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("every proposed change crosses the enforced source contract", () => {
  assert.match(app, /flow:\s*aeroFlowManifest\(signal, context, actions, safeAttachments\)/);
  assert.match(app, /run\.flow\.mode !== "enforce"/);
  assert.match(app, /AeroHarness\.digestContract\(run\) !== run\.contractDigest/);
  assert.match(app, /AeroHarness\.digestActions\(plannedActions\) !== AeroHarness\.digestActions\(message\.proposal\.actions\)/);
  assert.match(app, /derived\.secret/);
  assert.match(app, /id: `attachment\.\$\{index\}`/);
  assert.doesNotMatch(app, /else\s*\{\s*applied = applyActions\(message\.proposal\.actions\);\s*\}/);
});

test("reminders do not become personal memory", () => {
  assert.match(app, /remember\(\?!\\s\+to\\b\)/);
});
