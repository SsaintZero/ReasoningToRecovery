# Reasoning to Recovery – Technical Spec

_Status: updated 2026-02-11 — service skeleton + SQLite ledger + policy engine stub + incident API + demo script implemented._

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
5. 🔄 For `autoRemediate`, call:
   - Drift MCP `close_positions`
   - Jupiter quote+swap via AgentWallet x402 fetch
   - AgentWallet policy patch to pause key
6. 🔄 Persist incident and anchor SHA-256 hash on-chain (Memo tx signed by AgentWallet wallet).
7. ✅ Expose incident log via `GET /incidents`; 🔄 notify silicon via Telegram + provide explorer links.

## Key integrations
- **AgentWallet** – to sign memos, pause wallets, pay for swaps (pending wiring)
- **Helius** – webhook payloads feed `/webhooks/helius`
- **Drift / Jupiter** – remediation playbooks (currently simulated)
- **Telegram** – optional alert fan-out
- **Solana RPC** – memo anchoring (todo)

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
