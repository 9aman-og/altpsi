-- Make read-only reconciliation authoritative for lost commit responses.
-- A client may inspect historical work without receiving authority to dispatch
-- it again. The certificate is checked with PostgreSQL's original jsonb text
-- encoding, which is the exact encoding used when the server issued it.

create or replace function public.aero_inspect_run(
  p_user_id uuid,
  p_run_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run aero_private.aero_runs%rowtype;
  v_events jsonb;
  v_certificate_valid boolean := false;
begin
  select * into v_run
  from aero_private.aero_runs
  where id = p_run_id and user_id = p_user_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'run_not_found'); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'sequence', sequence,
    'type', event_type,
    'payload', payload,
    'previousDigest', previous_digest,
    'digest', event_digest,
    'createdAt', created_at
  ) order by sequence), '[]'::jsonb)
  into v_events
  from aero_private.aero_run_events
  where run_id = p_run_id and user_id = p_user_id;

  v_certificate_valid := coalesce(
    v_run.status = 'completed'
    and jsonb_typeof(v_run.completion_certificate) = 'object'
    and jsonb_typeof(v_run.completion_certificate->'payload') = 'object'
    and v_run.completion_certificate->>'digest' ~ '^[0-9a-f]{64}$'
    and v_run.completion_certificate->>'digest' = pg_catalog.encode(
      extensions.digest((v_run.completion_certificate->'payload')::text, 'sha256'), 'hex'
    )
    and v_run.completion_certificate->'payload'->>'runId' = v_run.id::text
    and v_run.completion_certificate->'payload'->>'status' = 'completed'
    and v_run.completion_certificate->'payload'->>'contractDigest' = v_run.contract_digest
    and v_run.completion_certificate->'payload'->>'targetDigest' = v_run.target_digest
    and v_run.completion_certificate->'payload'->>'eventHeadDigest' = v_run.event_head_digest
    and v_run.completion_certificate->'payload'->>'baseRev' = v_run.base_rev::text
    and v_run.completion_certificate->'payload'->>'newRev' = (v_run.base_rev + 1)::text
    and v_run.completion_certificate->'payload'->>'atomic' = 'true',
    false
  );

  return jsonb_build_object(
    'ok', true,
    'runId', v_run.id,
    'requestKey', v_run.request_key,
    'status', v_run.status,
    'contractDigest', v_run.contract_digest,
    'baseRev', v_run.base_rev,
    'targetDigest', v_run.target_digest,
    'review', v_run.review,
    'certificate', v_run.completion_certificate,
    'certificateValid', v_certificate_valid,
    'eventHeadDigest', v_run.event_head_digest,
    'eventSequence', v_run.event_sequence,
    'journalValid', aero_private.aero_event_chain_valid(v_run.id, p_user_id),
    'payloadValid', v_run.payload_storage_digest = aero_private.aero_payload_storage_digest(
      v_run.contract, v_run.contract_digest, v_run.base_rev, v_run.before_digest,
      v_run.target_data, v_run.target_digest, v_run.patches, v_run.review
    ),
    'events', v_events,
    'createdAt', v_run.created_at,
    'updatedAt', v_run.updated_at
  );
end
$$;

create or replace function public.aero_inspect_memory_transaction(
  p_user_id uuid,
  p_transaction_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_transaction aero_private.aero_memory_transactions%rowtype;
  v_events jsonb;
  v_certificate_valid boolean := false;
begin
  select * into v_transaction
  from aero_private.aero_memory_transactions
  where id = p_transaction_id and user_id = p_user_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'memory_transaction_not_found'); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'sequence', sequence,
    'type', event_type,
    'payload', payload,
    'previousDigest', previous_digest,
    'digest', event_digest,
    'createdAt', created_at
  ) order by sequence), '[]'::jsonb)
  into v_events
  from aero_private.aero_memory_events
  where transaction_id = p_transaction_id and user_id = p_user_id;

  v_certificate_valid := coalesce(
    v_transaction.status = 'completed'
    and jsonb_typeof(v_transaction.completion_certificate) = 'object'
    and jsonb_typeof(v_transaction.completion_certificate->'payload') = 'object'
    and v_transaction.completion_certificate->>'digest' ~ '^[0-9a-f]{64}$'
    and v_transaction.completion_certificate->>'digest' = pg_catalog.encode(
      extensions.digest((v_transaction.completion_certificate->'payload')::text, 'sha256'), 'hex'
    )
    and v_transaction.completion_certificate->'payload'->>'transactionId' = v_transaction.id::text
    and v_transaction.completion_certificate->'payload'->>'status' = 'completed'
    and v_transaction.completion_certificate->'payload'->>'contractDigest' = v_transaction.contract_digest
    and v_transaction.completion_certificate->'payload'->>'targetDigest' = v_transaction.target_digest
    and v_transaction.completion_certificate->'payload'->>'eventHeadDigest' = v_transaction.event_head_digest
    and v_transaction.completion_certificate->'payload'->>'baseRevision' = v_transaction.base_revision::text
    and v_transaction.completion_certificate->'payload'->>'newRevision' = (v_transaction.base_revision + 1)::text
    and v_transaction.completion_certificate->'payload'->>'atomic' = 'true',
    false
  );

  return jsonb_build_object(
    'ok', true,
    'transactionId', v_transaction.id,
    'requestKey', v_transaction.request_key,
    'status', v_transaction.status,
    'contractDigest', v_transaction.contract_digest,
    'baseRevision', v_transaction.base_revision,
    'targetDigest', v_transaction.target_digest,
    'review', v_transaction.review,
    'certificate', v_transaction.completion_certificate,
    'certificateValid', v_certificate_valid,
    'eventHeadDigest', v_transaction.event_head_digest,
    'eventSequence', v_transaction.event_sequence,
    'journalValid', aero_private.aero_memory_event_chain_valid(v_transaction.id, p_user_id),
    'payloadValid', v_transaction.payload_storage_digest = aero_private.aero_memory_tx_storage_digest(
      v_transaction.operation, v_transaction.operation_digest,
      v_transaction.contract, v_transaction.contract_digest,
      v_transaction.base_revision, v_transaction.before_digest,
      v_transaction.target_state, v_transaction.target_digest, v_transaction.review
    ),
    'events', v_events,
    'createdAt', v_transaction.created_at,
    'updatedAt', v_transaction.updated_at
  );
end
$$;

comment on function public.aero_inspect_run(uuid, uuid) is
  'Read-only recovery view for one authenticated Aero run, including server-side completion-certificate validation.';

comment on function public.aero_inspect_memory_transaction(uuid, uuid) is
  'Read-only recovery view for one authenticated Aero memory transaction, including server-side completion-certificate validation.';
