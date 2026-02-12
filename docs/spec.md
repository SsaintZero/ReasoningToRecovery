# Reasoning to Recovery – Technical Spec

_Status: updated 2026-02-12 — SOLPRISM ingest, Helius signature checks, remediation integrations (Drift/AgentWallet/memo anchor), and enriched incident logs are live._

## Goal
Detect when an autonomous Solana agent’s execution diverges from its declared reasoning, and autonomously trigger remediation (position flattening, wallet pause, human alert) with verifiable on-chain evidence.

## Personas
- **Autonomous agent dev** – already emitting reasoning hashes (SOLPRISM/SlotScribe). Wants a safety net that intervenes when the bot drifts.
- **Fund / risk desk** – delegates capital to agents but needs rapid rollback if policy breached.
- **Judge / auditor** – needs tamper-proof incident history to evaluate trustworthiness.

## Scope (MVP)
1. ✅ Accept reasoning receipts (hash + plaintext plan + metadata) via HTTP.
2. ✅ Watch Solana tx flow for a designated wallet via Helius webhook simulator.
3. ✅ Compare intent vs execution across: venue, direction, size, leverage, attestation memo.
4. ✅ Run policy rules → pick outcome: `allow`, `warn`, `autoRemediate`.
5. ✅ For `autoRemediate`, call:
   - Drift MCP `close_positions` (hits configured endpoint or simulates)
   - AgentWallet policy patch to pause key (webhook + bearer auth)
   - Memo anchoring via Solana RPC when a keypair is present
6. ✅ Persist incident and anchor SHA-256 hash on-chain (Memo tx signed by configured keypair; marked as skipped when absent).
7. ✅ Expose incident log via `GET /incidents`; ✅ notify silicon via Telegram (links forthcoming when real txs exist).

## Key integrations
- **SOLPRISM** – adapter normalizes receipts posted to `/receipts/solprism`.
- **Helius** – webhook payloads feed `/webhooks/helius` and must pass HMAC validation when a secret is present.
- **Drift** – remediation playbook calls out to `DRIFT_CLOSE_ENDPOINT` (or simulates) to flatten positions.
- **AgentWallet** – webhook/API pause path invoked when violations hit `autoRemediate` severity.
- **Solana RPC** – memo anchoring writes the evidence hash on-chain via `SOLANA_MEMO_KEYPAIR`.
- **Telegram** – alert fan-out to silicon (bot token + chat ID).

## Data model (SQLite via `bun:sqlite`)
```
receipts (id, agent_id, receipt_hash, plan_json, reasoning, created_at)
executions (id, agent_id, signature, payload_json, created_at)
incidents (
  id, agent_id, receipt_id, execution_id, severity, policy_trigger, playbook,
  status, violations_json, remediation_json, memo_signature, evidence_hash, created_at
)
```

## Pipelines

### Receipt ingestion → `/receipts`
... (rest unchanged) ...

## Demo tooling
- `scripts/demo.ts` – posts a sample receipt, simulates an execution, prints `/incidents` to illustrate end-to-end behavior without needing external integrations.

## Stretch goals / risks
... (rest unchanged) ...
