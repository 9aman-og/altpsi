# Aero harness architecture and evaluation

## North star

Aero should let one person say less over time without reducing first-pass intent
accuracy or quietly increasing risk.

That is a harder target than building a capable chat loop. The product must
learn useful compression, preserve source boundaries, choose the right model,
complete work reliably, and keep authority with the person.

## What the frontier already does well

| System | Strongest useful idea | Gap Aero must close |
| --- | --- | --- |
| OpenClaw | A low-level executor with tool and authentication policy around it | Execution does not by itself prove long-term personalization or communication compression |
| Hermes Agent | Open skills, tool use, provider flexibility, and persistent learning | Learned behavior still needs explicit promotion, decay, dispute, and outcome governance |
| LangGraph | Durable checkpoints, interrupts, replay, and human review | Infrastructure primitives do not decide what is worth remembering or how much a person should need to repeat |
| OpenAI Agents SDK | Typed tools, guardrails, handoffs, traces, and approvals | The application still owns authority policy, memory quality, and end-to-end product evaluation |
| OpenRouter | Broad model access and routing | It is a model gateway, not a personal context, memory, authority, or verified-action harness |
| LongHorizon-Harness | Manager, fresh-context executor, and independent auditor | Strong task completion needs a consumer authority model and long-term adaptation layer |

Primary references:

- [OpenClaw harness](https://docs.openclaw.ai/concepts/agent-loop)
- [Hermes Agent](https://github.com/NousResearch/hermes-agent)
- [LangGraph durable execution](https://docs.langchain.com/oss/python/langgraph/durable-execution)
- [LangGraph human review](https://docs.langchain.com/oss/python/langchain/human-in-the-loop)
- [OpenAI Agents SDK guardrails](https://openai.github.io/openai-agents-python/guardrails/)
- [LongHorizon-Harness](https://arxiv.org/html/2608.01964)
- [Prompt-injection-resistant agent design](https://arxiv.org/html/2506.08837)

## Aero system

    request
      |
      v
    permissioned context pack
      |
      +--> flow governor ------> source / field / sink authorization
      |                               |
      +--> epistemic governor --> clarify / answer / propose / refuse
      |                               |
      |                               v
      |                         model router
      |                    local / cloud specialist
      |                               |
      +--> typed memory <-------------+
      |     episodic / semantic / project / procedural
      |                               |
      v                               v
    adaptation governor          immutable action plan
                                      |
                                      v
                             exact user approval
                                      |
                                      v
                     manage -> execute -> audit -> checkpoint
                                      |
                        +-------------+-------------+
                        |                           |
                     verified                 failed audit
                        |                           |
                   next step       reverse-compensate every write
                        |                           |
                        v                           v
              evidence certificate          atomic abort

The model may suggest. It never grants itself authority, expands its own
capabilities, or certifies that its own work succeeded.

## v0.5 execution invariants

1. Every action type is allow-listed.
2. Every concrete payload value is checked against the local action schema.
3. Every step has one narrow capability, route, risk class, and acceptance condition.
4. SHA-256 binds approval to intent, exact values, capability, route, acceptance,
   budget, idempotency keys, policy version, and rollback mode.
5. Approval expires after 30 minutes and is consumed once.
6. The executor receives one immutable action and a narrow fresh context.
7. A separate read-only auditor must return structured environment evidence.
8. Self-reported success and evidence-free success fail closed.
9. A later failure compensates every applied step in reverse order.
10. Compensation failure is surfaced as a distinct critical state; it is never
    reported as a clean rollback.
11. Only current, verified audit evidence can cross the transaction boundary.
12. Completion requires a tamper-evident certificate binding the action contract,
    evidence ledger, and full step coverage.
13. A failed run can retry only after a clean rollback and fresh user approval.
14. Unknown actions, fields, routes, capabilities, authority states, or budget
    changes fail closed.
15. After an account enrolls an approval device, every explicit record action
    and explicit memory change requires a fresh WebAuthn assertion with user
    verification. The assertion is bound to that prepared target, canonical
    contract digest, current approval hash, account, origin, and expiry.
16. Only a SHA-256 digest of the short-lived presence grant is stored. The raw
    grant exists in browser memory for one commit and is consumed in the same
    Postgres transaction as the target change.
17. Verified device removal revokes future assertions but preserves historical
    grant rows and completion-certificate evidence.
18. Only the current user request and fixed system policy may choose an
    operation and its cardinality. Workspace, external, model, derived, and
    unknown sources are data.
19. Every proposed action field carries source provenance. Joins inherit the
    weakest trust and strongest sensitivity label.
20. Sanitization can change content but cannot upgrade its origin or authority.
21. External content cannot silently create personal memory or select a memory
    deletion target. Promotion needs an explicit user memory request naming the
    source.
22. Secret-labeled values cannot enter an ordinary task, library, tracking, or
    memory sink.
23. The flow manifest and policy version are part of the exact approval digest
    and are rechecked before local or signed-in execution.
24. A blocked flow returns a source-to-field-to-sink counterexample and cannot
    reach the review surface.

## Transaction-bound user presence

An ordinary signed-in session proves account access, not that a person approved
one particular change. Aero therefore keeps sign-in and action approval as two
separate layers. The optional approval device uses the browser WebAuthn API and
a pinned SimpleWebAuthn verifier at the Edge Function boundary.

1. Enrollment is allowed only after recent interactive authentication evidence;
   a refreshed JWT alone is insufficient.
2. Registration is accepted only for `https://sonnesystems.com`, RP ID
   `sonnesystems.com`, with user verification required.
3. An approval challenge is stored privately and bound to the account, target
   type and ID, contract digest, current one-use approval hash, and expiry.
4. A successful UV assertion creates a random 60-second grant. The browser sees
   the raw grant once; Postgres stores only its SHA-256 digest.
5. The commit RPC locks the exact grant, revalidates every binding, applies the
   target, consumes both authorities, appends `presence_verified`, and closes
   the completion certificate in one database transaction.
6. Assertion replay, approval rotation, target drift, wrong-account use, expiry,
   and missing presence fail before any Lyfe or memory state changes.

The implementation follows the [WebAuthn Level 3](https://www.w3.org/TR/webauthn-3/)
challenge/origin/RP and UP/UV verification model and uses
[SimpleWebAuthn's server verifier](https://simplewebauthn.dev/docs/packages/server).
The interactive-auth bootstrap reads Supabase AMR evidence as documented in
[JWT fields](https://supabase.com/docs/guides/auth/jwt-fields).

## What the 2026 evidence changed

The v0.5 design is a direct response to several recent results:

- [CaMeL](https://arxiv.org/html/2503.18813) shows why both control flow and
  value-level data flow need software-enforced capabilities outside the model.
- [Sleeper Memory Poisoning](https://arxiv.org/html/2605.15338) demonstrates
  that malicious external context can become a delayed cross-session authority
  attack through persistent memory.
- [FAVA](https://arxiv.org/html/2607.27267) separates semantic permission
  extraction from deterministic graph authorization and returns precise
  counterexamples for forbidden source-to-sink flows.

- [LongHorizon-Harness](https://arxiv.org/html/2608.01964) shows large gains from
  explicit state, fresh-context execution, and an independent read-only auditor.
- [StructAgent](https://arxiv.org/html/2607.11388v1) strengthens that pattern with
  verifier-backed state transitions, checkpoints, and targeted recovery.
- [Cordon](https://arxiv.org/html/2606.17573v1) and
  [Agentic Transaction](https://arxiv.org/html/2608.13900v1) show why per-call
  guardrails are insufficient: multi-step work needs a semantic commit boundary,
  staged effects, lineage, and all-or-nothing recovery.
- [Evidence-Carrying Termination](https://arxiv.org/html/2608.23623) motivates a
  typed completion certificate in which every completion claim is bound to
  in-scope trace evidence.
- Microsoft's [action-bound approval protocol](https://microsoft.github.io/agent-governance-toolkit/adr/0030-action-bound-approval-protocol/)
  binds consent to the exact canonical request, expiry, subject, target, and
  operation, then revalidates immediately before execution.
- [Capability Gates Are Not Authorization](https://arxiv.org/html/2606.28679)
  explains why exposing a tool cannot authorize its concrete argument values.
- [STALE](https://arxiv.org/html/2605.06527) and
  [MemTxn](https://arxiv.org/html/2607.27834) identify the next memory frontier:
  conflict-aware commits, cascading invalidation, version resolution, and
  application-visible recovery.
- [EOPA](https://arxiv.org/html/2608.04416v1) supports evidence-driven online
  preference adaptation without retraining; [PAUSE](https://arxiv.org/html/2607.27354v1)
  demonstrates that stateful personal-assistant behavior remains difficult even
  for leading proprietary systems.

## Deterministic invariant benchmark

`aero-harness.benchmark.js` executes 25 adversarial scenarios across approval
binding, information flow, tool security, verification, recovery, and
termination. The deterministic Aero harness v0.5 passes 25/25. An intentionally
minimal direct model-to-tool loop passes 0/25 because it has none of these
controls.

The transaction-bound user-presence boundary is evaluated separately by
protocol tests, static migration tests, and a production rollback test. It is
not counted in the 25-case browser benchmark.

This is a harness control experiment, not a benchmark of OpenClaw, Hermes, or
any other third-party system. It proves that the implementation enforces its
declared local invariants. It does not prove better real-world task performance.

Run it with:

```powershell
node aero-harness.test.js
node aero-flow.test.js
node aero-harness.benchmark.js
```

## Memory governance

Memory is a controlled data product, not an ever-growing transcript.

| Type | Stores | Promotion rule | Decay rule |
| --- | --- | --- | --- |
| Episodic | What happened in one bounded event | Explicit event or verified outcome | Compress after the retrieval horizon |
| Semantic | Stable fact or preference | Explicit statement or repeated verified evidence | Recheck when contradicted |
| Project | Decisions, constraints, and evidence for one project | Verified project outcome or explicit save | Archive with the project |
| Procedural | A repeatable way the person works | At least three successes across two days, with no failure | Demote after correction, contradiction, or sustained non-use |

Every memory keeps source, confidence, timestamps, scope, evidence, and dispute
state. Imported chats remain retrievable knowledge and do not silently become
personal facts.

Memory v0.2 also keeps revision lineage, source references, dependency edges,
and a bounded transaction journal. Explicit corrections supersede older slot
revisions, disputed or stale memories stay out of prompts, and invalidation
cascades to downstream memories. See [`AERO-MEMORY.md`](AERO-MEMORY.md).

## Model routing

Routing optimizes for the smallest sufficient capability:

1. Deterministic local functions for direct Lyfe operations.
2. Local open models for private general reasoning when available.
3. A free-tier cloud route for prompts that contain no private Lyfe context.
4. Optional paid or specialist routes only after explicit connection and policy.
5. Fallback to a smaller or local route without bypassing the action validator.

The router records the engine that actually answered, latency, failure, and why
the route was eligible. Subscriptions such as ChatGPT Plus and Google AI Pro are
not treated as developer API credit.

The clean-room app now implements that boundary for context-free general
questions. When the signed-in, account-allowlisted free specialist is enabled,
the browser sends only the current prompt, date, and intent family. It never
sends the context pack, prior messages, Gmail, memory, projects, imported files,
or attachment data. Workspace intent and direct actions stay local. A model may
return action-shaped output, but the client discards it; only the deterministic
local parser can open a reviewable action contract. Provider failure falls back
locally and enters a short backoff instead of retrying aggressively.

## Attention governance

Proactivity is a separate deterministic decision system, not another model
permission. Structured task and run facts enter a quiet Updates feed. Focus,
quiet hours, source trust, learned silence, deduplication, and a daily budget
decide whether one item may also interrupt. The normal budget is one per day; a
second requires a distinct critical condition after at least one hour; two is a
hard maximum. See [`AERO-ATTENTION.md`](AERO-ATTENTION.md).

## Evaluation scorecard

No single benchmark can establish that Aero is the best harness. Release claims
require this scorecard across repeated trials.

| Dimension | Metric | v0 evidence gate |
| --- | --- | --- |
| Intent | Environment-verified first-pass intent accuracy on the same recurring routine | At least 90%, no worse than -5 points versus baseline, with a one-sided 95% Wilson lower bound of at least 80% across reliable routine clusters |
| Compression | Initial plus follow-up user words for every exact matched routine, including misses | At least 25% macro-mean and 20% routine median reduction across 30 pairs, 12 routines, 2 adapted repeats per routine, and 7 days |
| Completion | Environment-verified acceptance conditions | 100% of reported completed steps audited |
| False finish | Agent says done while a verifier fails | 0 in the release suite |
| Authority | Unapproved or tampered plans executed | 0 across adversarial trials |
| Replay | Duplicate side effects after resume | 0 across crash and retry trials |
| Memory | False promotion rate | At most 5% |
| Recovery | Failed audit compensated and downstream work stopped | 100% in supported reversible actions |
| Initiative | Unrequested conversation messages | 1 normally, 2 only for distinct urgency |
| Cost | Paid calls without explicit opt-in | 0 |
| Accessibility | Keyboard, focus, target, contrast, and reduced motion checks | All release-critical checks pass |

`aero-eval.js` implements the preregistered N-of-1 gate. It derives only
opaque routine keys, excludes synthetic and same-process positive results from
release evidence, and counts clarifications, corrections, rejections, undos,
constraint misses, negative transfer, and stale-preference failures. Metrics are
macro-averaged by routine so one frequently repeated easy workflow cannot
dominate the result. See
`AERO-EVALUATION.md` for the research basis and exact protocol.

For long-horizon work, add WeaveBench, Terminal-Bench, OSWorld, and a Lyfe-native
suite of real personal workflows. Use programmatic environment graders when
possible, at least three repeats, full event traces, partial progress, time,
tokens, retries, corrections, and compensation rate.

## Clean-room rule

Aero is an AltPsi consumer product. Historical research and academic work remain
outside this clean product implementation.

## Honest current state

The current build proves the bounded personal action loop in the browser and
connects it to Lyfe context, typed memory, projects, Gmail metadata, model
routing, and communication-compression telemetry. It does not yet prove
world-leading long-horizon benchmark performance. The public product's auditor
and compensator still share one browser process. A tested FastAPI reference
boundary provides encrypted server-owned contracts, one-use authority,
deterministic patches, event chaining, completion certificates, and cross-
restart recovery for reversible Lyfe records.

The v0.5 Flow Governor labels user, workspace, external, model, derived, and
unknown sources; deterministically authorizes operation types from the current
user request; binds field provenance to the action contract; and quarantines
external-to-memory promotion. Its focused adversarial groups and seven added
benchmark scenarios pass. This is a deterministic browser policy, not a formal
noninterference proof: field attribution remains heuristic, source metadata is
trusted product code, and the signed-in server does not yet reconstruct a full
permission graph from connector-origin attestations. See
[`FRONTIER-HARNESS-RESEARCH.md`](../docs/FRONTIER-HARNESS-RESEARCH.md).

The original compression counter grouped episodes by broad action family. That
was useful directional telemetry but could pair unrelated tasks and overstate
learning. The current evaluator does not permit that claim: it pairs only the
same opaque routine, counts all user follow-up and repair effort, requires
environment verification for positive action outcomes, and keeps synthetic or
same-process trials out of release evidence. No real longitudinal trial has yet
met the preregistered gate.

The signed-in production path is deployed and enabled for the immutable private
account allowlist. An authenticated Supabase Edge Function closes the action schema and
materializes an exact target from the current account revision; Postgres then
locks the run and Lyfe row, verifies the payload and evidence chain, consumes a
short-lived approval hash, and commits the target with compare-and-swap in one
transaction. Completed, stale, and cancelled runs remove duplicated Lyfe state
and action subjects while retaining their digests and evidence. The browser
keeps the raw approval token in memory only.

The consumer shell also has a protected, stateless reasoning route for eligible
general questions and a local attention governor. These additions improve
answer usefulness and restraint; they do not change the execution authority
boundary and do not count as longitudinal evidence for the compression gate.

The 29 August 2026 production smoke covered prepare/cancel, exact commit,
concurrent-revision rejection, journal inspection, replay denial, and privacy
deletion on the signed-in account. Cancellation and stale approval produced zero
task writes; the committed run produced exactly one task and a completion
certificate. All three terminal states passed payload and event-chain checks.
The two disposable runs were deleted with their cascaded events, leaving no
orphans; the completed certificate remains as durable evidence.

Transactional memory now has a private signed-in authority in Postgres. The
browser is a cache; explicit writes bind one exact typed target to one current
revision and one-use approval, while feedback can produce only behavior-
authority candidates. Conflict lineage, cascading invalidation, privacy
forget/reset, terminal redaction, relational projection, and a hash-chained
evidence journal are enforced at the server boundary. Arbitrary external tools
are not enabled.

Transaction-bound WebAuthn presence is now deployed for private accounts as an
optional stronger approval mode. A rollback-only production SQL trial proves
the server invariants: unenrolled review remains compatible; enrolled actions
fail without presence; wrong target, approval, and grant bindings change no
state; presence and the target commit atomically; replay is denied; completion
is presence-certified; and verified revocation retains the audit rows. The same
trial leaves no disposable records. This is not yet evidence that every real
authenticator/browser combination works: a real-device enrollment and action
trial remains a release gate.

Current limitations are explicit. The trusted UI could still misdescribe a
contract even though the signed assertion cannot be reused for a different
server-side target. The v0.1 recovery model supports one active credential;
loss of that credential requires operator-assisted recovery. Unenrolled
accounts retain review-click approval. WebAuthn proves user verification at an
authenticator, not that the person understood the plan.

The next evidence gates are a real-authenticator production trial, network-
interruption trials around assertion and commit response loss, learned conflict
detection with a held-out false-conflict set, and repeated Lyfe-native tasks
with environment graders. The architecture and tests are designed so stronger
claims can be earned rather than declared.
