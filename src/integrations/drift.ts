import { config } from "../config";

export type DriftCloseParams = {
  agentId: string;
  market: string;
  size: number;
};

export type DriftResult = { ok: boolean; detail?: string };

export async function closePositions(params: DriftCloseParams): Promise<DriftResult> {
  if (!config.drift.closeEndpoint) {
    console.log(`[drift] simulate close_positions for ${params.market}`);
    return { ok: true, detail: "simulated" };
  }

  const response = await fetch(config.drift.closeEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.drift.apiKey ? { Authorization: `Bearer ${config.drift.apiKey}` } : {}),
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, detail: `drift ${response.status}: ${text}` };
  }

  const data = await response.json().catch(() => ({}));
  return { ok: true, detail: data.signature || data.tx || "flattened" };
}
