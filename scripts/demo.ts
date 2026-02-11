const BASE_URL = process.env.R2R_BASE ?? "http://127.0.0.1:8787";

async function postReceipt() {
  const payload = {
    agentId: "bot-tom",
    receiptHash: "demo-hash",
    plan: {
      agentId: "bot-tom",
      venue: "drift",
      market: "SOL-PERP",
      side: "long",
      size: 1,
      leverage: 1,
      memoHash: "demo-hash",
    },
    reasoning: "Go long SOL on Drift with 1x leverage",
  };

  const res = await fetch(`${BASE_URL}/receipts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Failed to create receipt: ${res.status}`);
  }

  const json = await res.json();
  return json.receiptId as string;
}

async function postExecution() {
  const payload = {
    agentId: "bot-tom",
    signature: `demo-sig-${Date.now()}`,
    venue: "jupiter",
    market: "SOL-PERP",
    side: "short",
    size: 2,
    leverage: 3,
    memo: "demo memo",
  };

  const res = await fetch(`${BASE_URL}/webhooks/helius`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Execution webhook failed: ${res.status}`);
  }

  return res.json();
}

async function listIncidents() {
  const res = await fetch(`${BASE_URL}/incidents?limit=5`);
  if (!res.ok) {
    throw new Error(`Failed to list incidents: ${res.status}`);
  }
  return res.json();
}

async function main() {
  console.log(`Posting demo receipt to ${BASE_URL}`);
  const receiptId = await postReceipt();
  console.log(`Created receipt ${receiptId}`);

  console.log("Simulating execution drift via webhook...");
  const result = await postExecution();
  console.log("Webhook result:", JSON.stringify(result, null, 2));

  console.log("Latest incidents:");
  const incidents = await listIncidents();
  console.log(JSON.stringify(incidents, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
