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

- **Receipt Ingest** – HTTP endpoint + adapters for:
  - SOLPRISM commit/reveal (hash + plaintext reasoning)
  - SlotScribe memo references
  - Raw JSON trace (for agents without a spec)
- **Execution Watcher** – Helius webhooks (or polling) for the agent's Solana key(s). We parse instructions via `@solana/web3.js` + protocol-specific decoders.
- **Diff Engine** – Compares declared intent vs executed tx: token symbols, venues, slippage, leverage, notional, additional instructions. Emits structured violations.
- **Policy Engine** – JSON/YAML rules evaluated via `json-rules-engine`. Example rules:
  - `IF venue != declaredVenue -> severity=critical`
  - `IF leverage_used > leverage_planned * 1.2 -> autoRecover`
  - `IF memo missing reasoning hash -> warn`
- **Recovery Orchestrator** – Library of playbooks:
  - `drift.close_position`: call Drift’s REST/MCP to flatten.
  - `jupiter.swap_to_stable`: convert residual to USDC via AgentWallet x Jupiter.
  - `agentwallet.revoke_session`: call AgentWallet policy API to pause.
  - `telegram.notify`: send evidence package to silicon.
- **Evidence Ledger** – Postgres (or Lite) table + on-chain memo anchor with SHA-256 of full incident JSON.
- **Demo CLI** – Simulate: post reasoning (go long SOL 1x), execute mismatch tx (short 5x). Watch R2R auto-detect, close via Drift devnet, ping Telegram, anchor memo.

## Tech stack

- **Runtime:** TypeScript (Bun) for fast dev + nice tooling.
- **Solana:** `@solana/web3.js`, Helius webhooks, Memo program for anchors.
- **Protocols:** Drift MCP/REST, Jupiter quote+swap, AgentWallet actions.
- **Storage:** SQLite (via `better-sqlite3`) for demo; swappable to Postgres.
- **Infra:** Docker Compose for local run (Bun app + SQLite + ngrok webhook).

## Roadmap to submission

1. ✅ Ideation + repo seed
2. 🔄 Spec + architecture doc (`docs/spec.md`)
3. 🔄 Minimal service skeleton (Bun, Fastify, Prisma/SQL)
4. 🔄 Integrations
   - Reasoning receipt adapter (SOLPRISM compatible)
   - Helius webhook ingestion (mockable)
   - Drift + AgentWallet remediation stubs (devnet)
5. 🔄 Incident pipeline demo script + video
6. 🔄 Colosseum project entry (problem/approach/audience/etc.)
7. 🔜 Submission polish: README, architecture diagram, sample traces, anchor explorer links

## Links

- Repo: https://github.com/SsaintZero/ReasoningToRecovery
- Hackathon project (draft): _pending_
- Solana devnet wallet (AgentWallet): `9RrPnkM3ZZ2E5bDAsAJnLnW1Lu9oEq4djTNRry7mSPBm`
- Telegram updates: `@1226829101`

---

> _"Proof of cognition is half the story. Proof of containment is the rest."_
