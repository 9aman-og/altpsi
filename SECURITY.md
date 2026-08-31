# Security

Report a vulnerability privately to the repository owner. Do not include account
data, provider tokens, exported conversations, or screenshots containing private
workspace content in a public issue.

## Product boundary

- Provider secrets live only in server-managed secret storage.
- Browser configuration may contain a publishable Supabase client key; it must
  never contain a service-role key or model-provider secret.
- Every private row is account-scoped. External actions use an exact review,
  current user presence, and a post-action verification receipt.
- Imported chats and files stay local unless the person explicitly chooses a
  server-backed operation.
- The EOS/SOL research lineage and any confidential academic material are outside
  this repository and outside Aero's implementation boundary.
