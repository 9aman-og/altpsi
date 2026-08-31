# Aero architecture

Aero is one product with six consumer surfaces: Today, Tracking, Library,
Connect, Gmail, and Aero. The final surface is not merely chat; it is the control
layer that composes the others.

## Control path

1. The context engine creates the smallest source-scoped view that can answer the
   request.
2. Typed memory supplies episodic, semantic, project, and procedural claims with
   provenance, confidence, and expiry.
3. The epistemic governor separates observed facts, user assertions, inferences,
   and unresolved conflicts.
4. The adaptation governor decides whether repeated evidence is strong enough to
   alter defaults. A correction wins immediately; weak correlations do not.
5. The router chooses a deterministic local function, local model, or explicitly
   enabled remote model for each bounded step.
6. The action engine produces an exact preview. Account-scoped presence binds the
   approval to that preview before the transaction can commit.
7. The evaluator records outcome-shaped telemetry without prompt content and
   tests whether repeated work needs fewer words without losing intent accuracy.

## Authority boundary

Models may propose. The harness decides what context they receive, which tools
they can call, what evidence counts, and when a run must stop. No model owns
memory promotion, external authority, or success claims.

## Research separation

This is a clean-room consumer implementation. Historical EOS/SOL work and any
confidential academic material are neither dependencies nor training inputs.
