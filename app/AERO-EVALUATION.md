# Aero longitudinal evaluation

## Claim under test

Aero's product claim is deliberately narrow and falsifiable:

> For the same person's recurring work, Aero should reduce the person's total
> communication over time without reducing verified first-pass intent accuracy.

This is not equivalent to remembering facts, producing shorter replies, or
completing unrelated short tasks. The evaluator therefore pairs the same
privacy-safe routine before and after adaptation and retains every miss.

## What current evidence changes

- [HorizonBench](https://arxiv.org/html/2604.17283) separates retrieval failure
  from belief-update failure and uses pre-evolution preferences as hard
  negatives. Aero records stale-preference violations separately instead of
  counting retrieval as personalization.
- [LoCoMo-Plus](https://aclanthology.org/2026.acl-long.1150/) evaluates whether
  behavior remains consistent with latent constraints under cue-trigger
  semantic disconnect. Aero scores constraint consistency, not string overlap.
- [IBA-Bench](https://arxiv.org/html/2608.02171) identifies a knowledge-to-action
  gap: an agent may retrieve a preference yet ignore it during execution. Aero
  counts only the materialized action and its constraints, not a correct verbal
  explanation.
- [Value of Information](https://aclanthology.org/2026.acl-long.1987.pdf) treats
  clarification as expected decision value weighed against user effort. Aero
  includes clarification turns and follow-up words in communication cost; it
  never makes shorter initial prompts look good by asking more afterward.
- [Evidence-driven Online Preference Adaptation](https://arxiv.org/html/2608.04416)
  grounds proactive timing in contextual evidence and feedback rather than
  unconstrained natural-language reflection. Aero keeps proactive adaptation
  non-parametric and evidence-bounded; it does not pretend that prompt summaries
  are training.
- [LongHorizon-Harness](https://arxiv.org/html/2608.01964) advances state only
  from independently inspected environment facts. Aero's release evaluator
  accepts positive action outcomes only from the server-atomic execution path.
- [AgentRewind](https://arxiv.org/pdf/2608.14380) evaluates recovery across
  aligned agent and environment checkpoints. Aero reports correction, undo,
  stale-state, and negative-transfer failures instead of hiding repaired runs.

These papers motivate the design; their reported results are not Aero results.

## Trial record

`aero-eval.js` derives a bounded record from an Aero episode:

- an opaque routine key derived from the action type and stable action subject;
- baseline, adapted, or holdout phase;
- environment, user, local, or synthetic verification class;
- the server transaction UUID and SHA-256 completion-certificate digest for
  positive action evidence;
- total initial and follow-up user words;
- clarification and correction turns;
- expected and satisfied constraints;
- preference revision and stale-preference violation;
- accepted, helpful, missed, rejected, or undone outcome.

Routine keys are salted SHA-256 digests. The per-workspace random salt remains
inside private Lyfe sync data; the key does not contain the user's prompt or
action title. It is an unlinkability and collision-resistance measure, not an
authorization signature. The evaluator never exports raw chat text.

## Success definitions

An action is a **verified success** only when:

1. the outcome is positive;
2. the exact action committed through the server-atomic boundary;
3. every declared constraint was satisfied; and
4. no stale-preference violation was recorded.

It is **first-pass** only when it was also completed without a clarification or
correction turn. A rejected, missed, or undone action is always retained as a
failure. A positive local-browser result is directional evidence because its
auditor shares the browser process; it is not release evidence.

The browser records environment verification only when the completed run or
memory transaction returns both its server UUID and its 64-character
completion-certificate digest. A route label without that receipt remains local
evidence. The v0.1 receipt is retained for audit correlation; a future
server-owned study ledger should independently re-verify every receipt before a
public aggregate is published.

## Preregistered v0.2 gate

The product may display `personal evidence ready` only when every condition is
true:

| Gate | Threshold |
| --- | ---: |
| Environment-verified matched pairs | at least 30 |
| Distinct recurring routines | at least 12 |
| Environment-verified adapted repeats per routine | at least 2 |
| Distinct study days | at least 7 |
| Mean total-communication reduction | at least 25% |
| Median pair reduction | at least 20% |
| Adapted first-pass accuracy | at least 90% |
| Adapted minus baseline first-pass accuracy | no worse than -5 points |
| One-sided 95% Wilson lower bound for routine reliability | at least 80% |
| Adapted constraint consistency | at least 95% |
| Negative-transfer rate | at most 5% |
| Stale-preference violations | exactly 0 |
| Duplicate episode IDs or completion receipts | exactly 0 |

Compression, accuracy, constraint consistency, and negative transfer are
macro-averaged across recurring routines, so repeating one easy routine cannot
dominate the claim. A routine is reliable only when every included adapted
execution succeeds on the first pass. The Wilson bound is calculated across
those routine clusters, not across correlated repeats. It remains an absolute
guardrail rather than a formal paired non-inferiority confidence interval.

## N-of-1 protocol

1. Choose at least twelve real recurring Lyfe workflows. Do not choose them because
   their wording is easy to shorten.
2. Complete the first signed-in instance normally. That server-certified result
   becomes the baseline for its opaque routine key.
3. Repeat each workflow naturally at least twice across at least seven days. Do not script a
   shorter request merely to improve the metric.
4. Reject, correct, or mark missed anything that does not match the intended
   result. Do not remove inconvenient trials.
5. Inspect each gate only after the preregistered sample is complete.
6. Treat a passing result as evidence for this person and these routines. It is
   not population evidence and does not establish superiority over another
   harness.

## Training boundary

Aero currently adapts through typed memory and bounded evidence, not foundation
model fine-tuning. No model training should begin until there is a consented
dataset, a held-out evolving-preference set, an explicit false-conflict set, and
a frozen evaluation protocol. Helpful-example export remains manual and
consent-gated.

## Run locally

```powershell
node aero-eval.test.js
node aero-core.test.js
node --test ../supabase/functions/aero-memory/protocol.test.mjs
```
