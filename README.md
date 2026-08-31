# AltPsi

AltPsi builds Aero, a private personal-intelligence layer that carries context
across a person's work and turns intent into inspectable, reviewable action.

This is the clean product repository. It intentionally excludes the historical
Sonne Systems research archive and the EOS/SOL research lineage. Compatibility
identifiers inherited from the earlier Lyfe client may remain inside local
storage and database code while the migration is in progress; they are not the
new public product architecture.

## Product shape

- `index.html`: the path-independent AltPsi product site.
- `app/`: the private Aero workspace, including Today, Tracking, Library,
  Connect, Gmail, and Aero.
- `demo/`: a public representative-data product demo.
- `backend/`: isolated API and execution-boundary tests.
- `supabase/`: account-scoped functions, migrations, and rollback tests.
- `app/aero-*.js`: context, typed memory, evaluation, and action-harness code.

The temporary public mount is `https://sonnesystems.com/altpsi/`. Relative URLs
are deliberate so the same artifact can later move to the AltPsi domain without
rewriting the product.

## Local preview

Serve the repository root with any static server, then open `/` for the product
site and `/app/#/aero` for the workspace.

## Verification

Run `python scripts/checks.py`, the JavaScript test commands in the CI workflow,
and the backend test suite before publishing. The public-boundary check rejects
credential-shaped values and legacy research paths.
