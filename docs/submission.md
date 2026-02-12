# Reasoning to Recovery – Submission Packet

_Last updated: 2026-02-12_

## TL;DR
- **Problem:** Reasoning receipts prove what agents *wanted* to do, but offer zero containment when executions drift.
- **Solution:** R2R watches Solana transactions, diffs them against signed intent, triggers automated playbooks (flatten, pause, alert), and anchors the full incident+remediation bundle back on-chain for auditors.
- **Status:** Local service + CLI demo complete, SOLPRISM ingest live, Helius webhook verified, remediation hooks wired with graceful fallbacks, incidents stored with evidence hashes.
- **Next ship items:** Plug in real Drift/AgentWallet endpoints, capture memo signatures on devnet, record final video walkthrough.

## Submission Narrative
### Problem & Motivation
Autonomous trading agents now publish hashed chains-of-thought (SOLPRISM, SlotScribe, etc.) so risk desks can audit decisions after the fact. But when an agent misfires in real time, those receipts provide no automatic protection—capital can be halved before a human inspects the logs. We need proof of *containment*, not just proof of cognition.

### Solution Overview
1. **Ingest reasoning receipts** (native JSON + SOLPRISM adapter) and persist them with reasoning hash + plan metadata.
2. **Monitor Solana execution** via Helius webhooks keyed to the agent wallet.
3. **Diff intent vs execution** using policy rules (venue, side, notional, leverage, memo hash).
4. **Decide & act**: allow, alert, or auto-remediate. Auto remediation currently chains:
   - Drift `close_positions` hook (simulated until endpoint is provided)
   - AgentWallet pause webhook (stubbed but ready for prod secret)
   - Memo anchor with SHA-256 evidence hash (skips when no keypair)
5. **Record + alert**: log to SQLite, expose `/incidents`, push Telegram message, store memo tx signature when available.

### Technical Lift
- Bun + Fastify service with typed schemas (Zod) and SQLite ledger via `bun:sqlite`.
- Helius signature verification (HMAC-SHA256 of raw body) ensures only authentic tx feeds trigger automation.
- SOLPRISM adapter normalizes JSON field names + number-like strings for drop-in compatibility with existing tooling.
- Remediation orchestrator tracks per-step status and evidence hash so auditors can see exactly what happened.
- Demo script hits the real endpoints, so judges can reproduce the entire loop locally in ~60 seconds.

## Demo Playbook (for judges)
1. `bun install && bun run src/server.ts`
2. In another shell, `bun run scripts/demo.ts`
3. CLI output will show receipt ID, webhook decision, remediation steps, and evidence hash.
4. `curl http://127.0.0.1:8787/incidents?limit=3` to view structured log.
5. (Optional) Provide `HELIUS_WEBHOOK_SECRET` and run the server behind a tunnel to watch signed webhooks.

## Video Script (draft)
1. **00:00–00:20** – Problem statement over slides/terminal: “Receipts prove intent; R2R enforces recovery.”
2. **00:20–00:40** – Show Fastify server log + describe endpoints.
3. **00:40–01:10** – Run `bun run scripts/demo.ts`; narrate violations and auto-remediation output.
4. **01:10–01:40** – `curl /incidents` and highlight evidence hash + remediation steps.
5. **01:40–02:00** – Close with roadmap: plug in Drift/AgentWallet endpoints + memo signature explorer link.

## Submission Checklist
- [x] README + spec updated with latest architecture + env vars
- [x] SOLPRISM adapter + Helius signature guard merged
- [x] Demo script verified (12 Feb)
- [ ] Memo keypair configured + devnet anchor screenshot
- [ ] Real Drift closeout endpoint wired
- [ ] AgentWallet webhook + token live
- [ ] Final video + screenshots uploaded to Colosseum entry

## Links
- Repo: https://github.com/SsaintZero/ReasoningToRecovery
- Colosseum draft: https://colosseum.com/agent-hackathon/projects/reasoning-to-recovery
- AgentWallet: username `precioussilas100`, Solana `9RrPnkM3ZZ2E5bDAsAJnLnW1Lu9oEq4djTNRry7mSPBm`
- Demo tunnel (current session): https://true-cars-juggle.loca.lt/webhooks/helius (temporary)
