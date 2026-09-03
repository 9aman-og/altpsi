# Aero attention governor

## Product contract

Aero is useful before it is talkative. Background observations go to one quiet
Updates feed; they do not become chat messages. An interruption is a scarce
resource with these hard limits:

1. At most one ordinary unsolicited update per local day.
2. A second is allowed only for a different critical condition, at least one
   hour after the first.
3. Focus and quiet hours suppress interruptions without discarding the update.
4. The user can turn brief updates off at any time.
5. Model text and untrusted external content cannot give themselves permission
   to interrupt.

The daily budget is enforced in deterministic product code, outside any model.

## Decision path

    structured product fact
              |
              v
      normalize + deduplicate
              |
              v
    source / urgency trust gate
              |
       +------+------+
       |             |
    not eligible   eligible
       |             |
       v             v
    quiet feed   focus / quiet-hours / preference / budget gate
                         |
                  +------+------+
                  |             |
               suppress      interrupt
                  |             |
                  +------v------+
                     quiet feed

The current fact producers are task deadlines and failed action runs. Tasks are
grouped into overdue, due-today, and high-priority-tomorrow updates so ten items
do not create ten notifications. Rollback failure is a distinct critical
condition. Gmail importance is not inferred in v0 because sender content is not
a trustworthy urgency signal.

## Adaptation and privacy

Open, helpful, and dismiss outcomes update local category statistics. Two
dismissals with no positive outcome suppress later non-critical interruptions
in that category. Critical recovery conditions remain visible. The next
adaptation step is a held-out calibration trial before adding temporal anchors;
it will not silently retrain a language model.

Attention telemetry stores only time, an opaque fingerprint, category, urgency,
source type, decision, and reason. It never copies notification titles, task
names, details, mail text, or memory content.

This design follows three useful findings without claiming to reproduce their
full systems:

- [EOPA](https://arxiv.org/html/2608.04416v1) separates the
  interaction-or-silence decision from response generation and adapts timing
  from measurable feedback rather than unconstrained language-model reflection.
- [Sidekick](https://arxiv.org/html/2607.17527) motivates a low-attention ambient
  state for background work and compact resumption summaries instead of a
  stream of chat updates.
- [PASK](https://arxiv.org/html/2604.08000v1) treats demand detection, memory,
  and execution as separate cooperating subsystems.

## Verification

`app-next/core/attention.test.js` covers grouping, deduplication, source trust,
quiet hours, focus suppression, daily budgets, distinct critical escalation,
feedback adaptation, daily reset, read state, and metadata-only telemetry.

This is a deterministic v0 policy and not yet evidence of ideal personalized
timing. A release claim requires longitudinal opt-in use with precision, recall,
dismissal rate, interruption regret, and time-to-action measured per person.
