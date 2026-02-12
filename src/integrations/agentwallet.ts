import { config } from "../config";

export type AgentWalletResult = {
  ok: boolean;
  detail?: string;
};

export async function pauseAgentWallet(reason: string): Promise<AgentWalletResult> {
  if (!config.agentWallet.webhookUrl) {
    console.log(`[agentwallet] simulate pause: ${reason}`);
    return { ok: true, detail: "simulated" };
  }

  const response = await fetch(`${config.agentWallet.webhookUrl}/wallets/${config.agentWallet.address}/pause`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.agentWallet.apiKey ? { Authorization: `Bearer ${config.agentWallet.apiKey}` } : {}),
    },
    body: JSON.stringify({ reason, username: config.agentWallet.username }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, detail: `agentwallet ${response.status}: ${text}` };
  }

  const data = await response.json().catch(() => ({}));
  return { ok: true, detail: data.tx || data.status || "paused" };
}
