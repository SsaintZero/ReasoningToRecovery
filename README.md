# Reasoning to Recovery (R2R)

> **Close the loop between verifiable reasoning and verifiable remediation.**
>
> R2R ingests an autonomous agent's reasoning receipts (SlotScribe, SOLPRISM, or raw traces), watches the resulting Solana transactions, detects when execution drifts from intent, and automatically performs compensating actions (pause wallets, unwind positions, notify humans) – while anchoring the entire incident response back on-chain for auditors.

## Why this exists

Everyone is racing to make agents "provable" by hashing their CoT. That's useful, but it's reactive: you can look back after a blow-up and prove the bot hallucinated. It does nothing while the blast radius is expanding.

R2R adds a **recovery arc**:

1. **Detect:** Compare the signed reasoning hash + declared plan against the actual Solana instructions the agent broadcast. Identify drift: wrong market, oversized notional, missing guard rails, etc.
2. **Decide:** Policy engine scores the incident (allow, warn, auto-remediate) using configurable rules: e.g. "if leverage used > plan leverage * 1.2, auto-close".
3. **Recover:** Use AgentWallet + protocol adapters (Jupiter, Drift, Kamino) to flatten positions, revoke MPC sessions, or freeze allowances. Telegram/webhook alerts keep humans in the loop.
4. **Record:** Hash the full incident bundle (intent, tx signature, remediation actions) and write it back to Solana via Memo so downstream verifiers see *exactly* how the system responded.

## High-level architecture

```
┌────────────┐   reasoning receipts   ┌────────────────┐   tx webhooks   ┌───────────────┐
│ Agent SDKs │ ─────────────────────▶ │ Receipt Ingest │ ───────────────▶ │ Drift Monitor │
└────────────┘                        └────────────────┘                  └───────────────┘
        │                                          │                                │
        │                                   normalized traces                       │
        ▼                                          ▼                                ▼
┌────────────────┐        violations        ┌────────────────┐        actions   ┌────────────────┐
│ Policy Engine  │ ───────────────────────▶ │ Recovery Orchestrator │ ────────▶ │ AgentWallet/Protocols │
└────────────────┘                          └────────────────┘                  └────────────────┘
        │                                          │
        │                                          ▼
        │                           evidence hash + memo anchor
        ▼                                          │
┌────────────────┐                    ┌──────────────────────┐
│ Alert Fan-out  │ ◀────────────────── │ Incident Ledger (db + onchain) │
└────────────────┘                    └──────────────────────┘
```

## Core components (MVP scope)

- **Receipt Ingest** – HTTP endpoint + adapters for SOLPRISM, SlotScribe, or raw JSON traces.
- **Execution Watcher** – Helius webhooks (or polling) for the agent's Solana key(s). We parse instructions via `@solana/web3.js` + protocol-specific decoders.
- **Diff Engine** – Compares declared intent vs executed tx: token symbols, venues, slippage, leverage, notional, additional instructions. Emits structured violations.
- **Policy Engine** – JSON/YAML rules evaluated via `policy.ts` (e.g., venue mismatch, leverage breach, missing memo hash).
- **Recovery Orchestrator** – Library of playbooks (flatten & pause, warn-only) that will call Drift, Jupiter, AgentWallet, and Telegram in the full version. Current build simulates those steps and records evidence hashes.
- **Incident Ledger** – SQLite for demo; `/incidents` endpoint exposes the latest entries. Evidence hash will be anchored to Solana Memo in the next phase.
- **Demo CLI** – `bun run scripts/demo.ts` walks through posting a receipt, simulating drift, and retrieving the incident log.

## Getting started (local)

```bash
# prerequisites: Bun >= 1.3
curl -fsSL https://bun.sh/install | bash  # once per environment
export PATH="$HOME/.bun/bin:$PATH"

# install deps
bun install

# run the API (default port 8787)
bun run src/server.ts
```

Hit the endpoints:

- `GET /health`
- `POST /receipts`
- `POST /webhooks/helius`
- `GET /incidents?limit=20`

### Environment knobs

| variable | default | purpose |
| --- | --- | --- |
| `R2R_PORT` | `8787` | HTTP listen port |
| `R2R_DB_PATH` | `./r2r.sqlite` | SQLite file location |
| `R2R_LEVERAGE_TOLERANCE` | `0.2` | Allowed fractional delta before `LEVERAGE_BREACH` |
| `R2R_NOTIONAL_TOLERANCE` | `0.15` | Allowed fractional delta for size mismatch |
| `R2R_TELEGRAM_TOKEN`/`R2R_TELEGRAM_CHAT` | unset | Enable Telegram alerts |

### Sample flow (manual curl)

```bash
# 1) agent posts a reasoning receipt
curl -X POST http://localhost:8787/receipts \
  -H "Content-Type: application/json" \
  -d '{
    "agentId":"bot-tom",
    "receiptHash":"hash123",
    "plan":{
      "agentId":"bot-tom",
      "venue":"drift",
      "market":"SOL-PERP",
      "side":"long",
      "size":1,
      "leverage":1,
      "memoHash":"hash123"
    }
  }'

# 2) Helius (or script) posts the observed tx
curl -X POST http://localhost:8787/webhooks/helius \
  -H "Content-Type: application/json" \
  -d '{
    "agentId":"bot-tom",
    "signature":"sig-1",
    "venue":"jupiter",
    "market":"SOL-PERP",
    "side":"short",
    "size":2,
    "leverage":3,
    "memo":"memo"
  }'

# 3) Read the incident log
curl http://localhost:8787/incidents?limit=5
```

### Demo script

With the server running locally, execute:

```bash
bun run scripts/demo.ts
```

The script will:
1. Create a sample reasoning receipt
2. Simulate a drifted execution
3. Print the policy decision + remediation payload
4. Dump the latest incidents from `/incidents`

Pass `R2R_BASE=http://host:port` to point it at a remote deployment.

## Roadmap to submission

1. ✅ Ideation + repo seed
2. ✅ Spec + architecture doc (`docs/spec.md`)
3. ✅ Minimal service skeleton (Bun, Fastify, SQLite)
4. 🔄 Integrations
   - Reasoning receipt adapter (SOLPRISM compatible)
   - Helius webhook ingestion (mockable)
   - Drift + AgentWallet remediation stubs (devnet)
5. 🔄 Incident pipeline demo script + video (**script done**, video pending)
6. ✅ Colosseum project entry (problem/approach/audience/etc.)
7. 🔜 Submission polish: README, architecture diagram, sample traces, anchor explorer links

## Links

- Repo: https://github.com/SsaintZero/ReasoningToRecovery
- Hackathon project (draft): https://colosseum.com/agent-hackathon/projects/reasoning-to-recovery
- Solana devnet wallet (AgentWallet): `9RrPnkM3ZZ2E5bDAsAJnLnW1Lu9oEq4djTNRry7mSPBm`
- Telegram updates: `@1226829101`

---

> _"Proof of cognition is half the story. Proof of containment is the rest."_
