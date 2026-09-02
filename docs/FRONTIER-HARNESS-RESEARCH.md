# Aero frontier-harness research note

Research snapshot: 2 September 2026. The working review covered 156 fetched
results across 16 workstreams, deduplicated to 146 distinct sources. This note
records the evidence that changed the product architecture. It is not a claim
that Aero is categorically better than every other agent system.

## Decision

The model is not Aero's security boundary.

Aero separates three things that ordinary chat loops tend to collapse:

1. **Intent authority** — only the current user request and fixed system policy
   may choose an operation.
2. **Value provenance** — Gmail, Connect, Library, imported chats, files, web
   pages, workspace state, and model output remain labeled data.
3. **Effect authority** — a deterministic governor must authorize the exact
   source-to-field-to-sink flow before the plan can be reviewed or executed.

Prompt instructions remain useful defense in depth, but do not grant authority.

## Evidence that drove the design

### Control flow and data flow must both be protected

[CaMeL](https://arxiv.org/html/2503.18813) demonstrates a software-security
approach in which a trusted query defines control flow, values carry source and
reader capabilities, and policy is enforced outside the model. Its AgentDojo
evaluation reported 77% task utility with the stated security guarantee versus
84% for the undefended system. The important design lesson is not the exact
score; it is that protecting only the sequence of tools is insufficient when
untrusted content can still choose arguments.

[AgentDojo](https://arxiv.org/html/2406.13352) provides the relevant threat
model and benchmark shape: external data can contain an injection while the
agent has access to real tools and private state.

### Persistent memory creates delayed authority attacks

[Sleeper Memory Poisoning](https://arxiv.org/html/2605.15338) studies attacks in
which a document, webpage, email, repository, or shared file causes a fabricated
user memory to be written and later used in a different conversation. The paper
reports very high poison-write rates in several evaluated assistants and
attacker-intended agentic actions in 60–89% of successful retrieval cases.

That changes Aero's memory rule: external material may stay retrievable
knowledge, but it cannot become personal memory merely because a model inferred
it. Promotion requires an explicit memory request naming the relevant source.
External content can never select a memory-forget target.

### Authorization should be deterministic and evidence-backed

[FAVA](https://arxiv.org/html/2607.27267) separates natural-language permission
extraction from deterministic authorization over an evidence-backed permission
graph. It propagates labels over data-flow edges, treats sanitizers as explicit
trusted transformations, and can return a source-to-sink counterexample. FAVA
is also explicit about its boundary: formal soundness begins after the graph is
correctly extracted and only covers effects mediated by its gateway.

Aero v0.5 adopts the useful product-level subset now:

- a typed flow manifest;
- deterministic operation authorization from the user's words;
- source labels on every proposed field;
- monotone trust and sensitivity joins;
- no authority upgrade from sanitization;
- exact flow binding inside the approval digest;
- concise counterexamples for blocked flows.

Aero does **not** claim an SMT or end-to-end noninterference proof. Its current
field attribution is conservative deterministic matching over the context pack,
not a formally verified compiler.

### Tool visibility and login are not action authorization

The [OpenAI Agents SDK context guide](https://openai.github.io/openai-agents-js/guides/context/)
notes that hiding a tool is not sufficient authorization for its arguments;
enforcement belongs inside execution, guardrails, or approval. The
[Vercel AI SDK approval guide](https://ai-sdk.dev/docs/agents/tool-approvals)
similarly treats approval as a separate step in a tool lifecycle.

The [MCP security guidance](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices)
separates per-client consent, token audience, and downstream authority and
explicitly forbids token passthrough. Aero therefore does not treat a connected
account, visible connector, consumer subscription, or model session as
permission for a concrete effect.

### Long work needs state, independent audit, and recovery

[LongHorizon-Harness](https://arxiv.org/html/2608.01964),
[Agentic Transaction](https://arxiv.org/html/2608.13900), and
[Evidence-Carrying Termination](https://arxiv.org/html/2608.23623) motivate the
rest of Aero's existing execution boundary: explicit task state, fresh-context
execution, read-only audit, atomic compensation, and a completion certificate.
The flow governor is placed before that boundary and its digest is passed into
execution, audit, and compensation contexts.

## Implemented v0.5 policy

| Source | Origin | May choose an operation? | May provide field data? | May silently become memory? |
| --- | --- | ---: | ---: | ---: |
| Current user request | user | yes | yes | only through an explicit memory action |
| Fixed product policy | system | yes | yes | no background promotion |
| Today / Tracking / Profile | workspace | no | yes | no |
| Gmail / Connect / Library / imports | external | no | yes | no |
| Model output | model | no | yes | no |
| Derived or sanitized text | derived | no | yes | no trust upgrade |

The browser action set remains local and reversible. There is no public-network
or payment sink in v0. Every action still needs an exact review, one-use
approval, bounded execution, evidence, and atomic recovery.

## Evaluation added with this change

- 15 focused Flow Governor invariant groups.
- 25/25 deterministic harness scenarios across authorization, information
  flow, tool security, verification, recovery, and termination.
- Adversarial cases for indirect operation selection, delayed memory poisoning,
  memory deletion targeting, secret-to-ordinary-store flow, unresolved
  provenance, negated intent, source spoofing, sanitizer upgrades, and
  post-approval flow tampering.

The comparison control is an intentionally minimal direct model-to-tool loop,
not OpenClaw, Hermes, or another product. Passing these tests establishes only
that Aero enforces the declared invariants.

## Honest remaining gaps

1. Field provenance is heuristic. Semantic laundering can evade lexical
   attribution, while conservative attribution can block a benign proposal.
2. The local auditor and executor share one browser process. Signed-in effects
   have a stronger server boundary, but the server does not yet independently
   reconstruct the full flow graph from attested connector reads.
3. Context-source metadata is trusted product code. Arbitrary third-party tools
   are not yet admitted into the source catalog.
4. Text-to-text misinformation can still reach the answer even when it cannot
   cause an effect. Source display and factual evaluation remain necessary.
5. No real longitudinal participant trial has yet proved the communication-
   compression north star.

## Next evidence gates

1. Move flow-manifest construction and origin attestation to the signed-in
   server boundary for connected sources.
2. Give untrusted parsing a quarantined, no-tool model context and keep the
   privileged planner blind to raw external text.
3. Add a graph authorizer before enabling any network, public, payment, or
   destructive sink.
4. Run AgentDojo-style indirect-injection and sleeper-memory suites against
   every supported model route, including paraphrase-based laundering.
5. Run the preregistered N-of-1 study: at least 30 matched pairs across 12 real
   routines and seven days, measuring fewer user words without lower verified
   first-pass intent accuracy.
