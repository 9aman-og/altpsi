# Aero settlement and recovery

Updated 21 November 2026. The browser recovery path works with the existing
account inspection API. A separate migration adds server-side validation of
the stored certificate checksum.

## The failure this closes

Atomic execution is not the same as a known outcome. The database can commit a
change and the final HTTP response can disappear. A client that treats the
timeout as failure may send the same semantic effect again; a client that calls
it success may lie.

Aero therefore treats `Unknown` as a real state. It does not infer absence from
a timeout or from one `prepared` read, and it never gives a model authority to
classify an ambiguous effect.

## Owned-state protocol

```text
prepared
   |
   | exact user approval; pending envelope persisted without tokens
   v
committing ---------------------------+
   |                                  |
   | response + matching target       | response lost / invalid
   v                                  v
completed                     cancel as row-lock fence
                                      |
                     +----------------+----------------+
                     |                                 |
                commit won                        cancel won
                     |                                 |
                     v                                 v
          inspect completed                    inspect cancelled
          + valid certificate                  + zero effect
                     |                                 |
                     +---------------+-----------------+
                                     v
                                  settled
```

The cancel RPC and commit RPC lock the same server-owned run. After an
ambiguous response, cancellation is a fencing operation, not an assumption:
whichever transaction wins makes the durable state terminal. Aero then uses a
read-only inspection route. It never automatically replays the commit.

## What is bound

The device saves one account-scoped record for each plan before dispatch:

- local and server run identifiers, the request key, and the action types;
- contract and target digests, the base revision, and the presence requirement;
- the recovery phase and its timestamps.

The record excludes approval tokens, device tokens, prompts, and memory claims.
If the browser cannot persist it, approval cannot dispatch the change. A
reopened review uses the same request key and server identity. A fresh approval
token stays in memory. Open outcomes remain visible in Activity across reloads.

Recovery verifies the following against the authenticated account journal:

- terminal status and exact run or transaction identity;
- contract digest and target digest;
- the committed event, certificate event head, and current hash-chain head;
- base and committed revision;
- atomic flag;
- stored payload integrity; and
- complete event-chain integrity.

The migration recomputes the certificate checksum from PostgreSQL’s JSON
representation. If the server reports an invalid checksum, Aero keeps the
outcome unconfirmed. Older servers establish recovery from the authenticated
commit journal and its matching certificate fields.

When the exact committed target is returned, the browser also recomputes its
canonical SHA-256 target digest. When a later account revision already exists,
the durable historical certificate establishes the old effect while Aero
adopts the newer state.

The browser mirrors the receipt into account history using the exact workspace
revision it read. That write changes only history. A competing workspace edit
causes a conflict, so the device retains the receipt until the next recovery
pass. Memory receipts retain the operation type and proof without a copy of
the claim.

## Consumer behavior

The interface has three mutually exclusive outcomes:

- **Changes applied** when the committed target and proof agree.
- **No changes applied** when the account record establishes that the plan
  stopped.
- **Outcome unconfirmed** when the evidence is inconclusive. The person can
  check status while Aero holds further approvals of that kind.

The recovered receipt says “Verified after reconnect.”

## External-effect boundary

This protocol is sufficient only for Aero-owned transactional state. A future
email, payment, publication, or arbitrary connector needs its own effect
contract: stable idempotency key, enforced deduplication horizon, authoritative
status query and visibility bound, compensation semantics, and authorization
timing. Without those guarantees Aero must keep the reservation `Unknown`,
block dependent effects, and hand control to the person rather than retry.

MCP annotations are hints, not enforcement. A durable workflow engine can
resume orchestration, but it cannot manufacture exactly-once behavior at a
non-idempotent sink.

## Fault gates

The integration suite runs the real action and memory protocols against an
isolated PostgreSQL instance with the repository migrations. It covers:

1. Workspace and memory commits, including a two-step request.
2. Account commit followed by response loss, offline reload, and recovery.
3. Cancellation before delayed commit and a second approval attempt.
4. Reopening the same review after restart and account isolation.
5. Rejection of inconsistent journal evidence and corrupted certificate hashes.
6. Recovery after a later account update and a conflict during receipt sync.
7. Private remember and forget operations through the server schema.
8. Dispatch blocked when browser storage is unavailable.

The next release evidence is a live disconnect trial with WebAuthn and a
multi-device network fault test. Track duplicate effects, incorrect completion
reports, recovery latency, and additional approvals.

## Research basis

- [Where Does Exactly-Once Live?](https://arxiv.org/html/2609.29095)
- [Permission to Retry](https://arxiv.org/html/2610.31916)
- [Evidence-Guided Recovery](https://arxiv.org/html/2610.41453)
- [CapLease](https://arxiv.org/html/2608.01710)
- [Evidence-Carrying Termination](https://arxiv.org/html/2608.23623)
- [Temporal Activity definition](https://docs.temporal.io/activity-definition)
- [RFC 9110 §9.2.2](https://datatracker.ietf.org/doc/html/rfc9110#section-9.2.2)

These sources support the architecture; they do not prove Aero's production
prevalence or superiority. Claims require the injected-fault and real-provider
results above.
