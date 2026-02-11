# Reasoning to Recovery – Technical Spec

## Goal
Detect when an autonomous Solana agent’s execution diverges from its declared reasoning, and autonomously trigger remediation (position flattening, wallet pause, human alert) with verifiable on-chain evidence.

## Personas
- **Autonomous agent dev** – already emitting reasoning hashes (SOLPRISM/SlotScribe). Wants a safety net that intervenes when the bot drifts.
- **Fund / risk desk** – delegates capital to agents but needs rapid rollback if policy breached.
- **Judge / auditor** – needs tamper-proof incident history to evaluate trustworthiness.

## Scope (MVP)
1. Accept reasoning receipts (hash + plaintext plan + metadata) via HTTP.
2. Watch Solana tx flow for a designated wallet via Helius webhook simulator.
3. Compare intent vs execution across:
   - Market / protocol (Drift vs Jupiter)
   - Direction (long/short)
   - Size / leverage
   - Slippage / price bounds
   - Extra instructions (unexpected transfers)
4. Run policy rules → pick outcome: `allow`, `warn`, `autoRemediate`.
5. For `autoRemediate`, call:
   - Drift MCP `close_positions`
   - Jupiter quote+swap via AgentWallet x402 fetch
   - AgentWallet policy patch to pause key
6. Persist incident and anchor SHA-256 hash on-chain (Memo tx signed by AgentWallet wallet).
7. Notify silicon via Telegram with summary + explorer links.

## Key integrations
- **AgentWallet**
  - Config: `~/.agentwallet/config.json`
  - Endpoints: `transfer-solana`, `x402/fetch`, `policy` PATCH, `sign-message`
- **Helius**
  - Webhooks: register for agent wallet; for demo use mock server pushing POST payloads.
  - SDK: `@helius-labs/helius-sdk` optional.
- **Drift MCP**
  - Use AlphaVault-style MCP or direct REST if available; fallback mock script for devnet.
- **Jupiter**
  - Quote via `https://quote-api.jup.ag/v6/quote` (devnet) with slippage control.
- **Telegram**
  - Bot token already configured; use `message` tool for manual tests, but service will call Telegram HTTP API.
- **Solana RPC**
  - `solana devnet` via Helius or standard RPC for memo submission.

## Data model (SQLite)
```
tagents (id, wallet_pubkey, reasoning_public_key, name)
receipts (id, agent_id, hash, payload_json, plan_json, created_at)
executions (id, signature, raw_tx_json, parsed_json, observed_at)
incidents (
  id, agent_id, receipt_id, execution_id,
  severity, policy_trigger, remediation_playbook,
  remediation_status, memo_signature, evidence_hash,
  alert_sent_at, created_at
)
```

## Pipelines

### 1. Receipt ingestion
- POST `/receipts`
- Body: `{ agentId, receiptHash, plan, reasoning, signedMemo(optional) }`
- Validate hash -> store -> ack with receipt ID.

### 2. Execution watcher
- Helius webhook POST `/webhooks/tx`
- For each tx:
  - Derive candidate receipt via `recent_receipt(agent, within=T)`
  - Parse tx (instructions, accounts, program IDs)
  - Build `ExecutionObservation` struct.

### 3. Drift detection
- Compare plan vs exec
- Example checks:
  - `plan.venue === "drift"` but tx program = Jupiter -> violation `VENUE_MISMATCH`
  - `exec.notional > plan.notional * (1 + tolerance)` -> `NOTIONAL_BREACH`
  - Missing memo referencing plan hash -> `MISSING_ATTESTATION`
- Collate results -> feed policy engine.

### 4. Policy evaluation
- Rules defined in `config/policies.json`
- Example rule format:
```json
{
  "id": "crit-venue",
  "when": { "violations": { "$contains": "VENUE_MISMATCH" } },
  "then": { "severity": "critical", "action": "autoRemediate", "playbook": "flatten_and_pause" }
}
```

### 5. Remediation playbooks
- `flatten_and_pause`
  1. Call Drift MCP `close_positions` (or stub) → expect tx sig
  2. AgentWallet `policy` patch: `{ "state": "paused", "reason": "incident-<id>" }`
  3. Anchor memo: `ReasoningToRecovery|incident:<id>|hash:<sha256>`
  4. Send Telegram alert with summary + explorer links
- `warn_only`
  - Telegram alert + record, no action

### 6. Evidence anchoring
- Build JSON payload: `incident`, `receipt`, `execution`, `remediation` (sanitized)
- `hash = sha256(JSON.stringify(payload))`
- Build memo instruction (base58 string) + send via AgentWallet `transfer-solana` with 0 SOL to self, memo text `R2R:<hash>`
- Store signature.

## Demo flow (for submission video)
1. Start local services (`bun dev`).
2. `scripts/postReceipt.ts` – send plan: "long 1 SOL on Drift, leverage 1x".
3. `scripts/postExecution.ts` – simulate webhook for tx that shorts 5 SOL via Jupiter.
4. Watch logs: violation triggered → policy selects `autoRemediate` → stub closes position → memo anchor → Telegram DM.
5. Show SQLite incident row + explorer link.

## Stretch goals (time permitting)
- UI dashboard (SvelteKit) with incident timeline.
- Support for multiple agents + multi-tenant policies.
- gRPC/REST interface for other agents to query incident history.
- Real Drift devnet integration (AlphaVault MCP).

## Risks / mitigations
- **Time constraint:** focus on clean demo path, mock heavy dependencies when needed.
- **RPC constraints:** use devnet + memo to self to avoid fees.
- **Security:** store secrets in `.env.local`, avoid committing tokens.

---
Status: _WIP_ (updated 2026-02-11)
