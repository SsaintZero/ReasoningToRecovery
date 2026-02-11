export type PlanIntent = {
  agentId: string;
  venue: "drift" | "jupiter" | "kamino" | string;
  market: string;
  side: "long" | "short" | "swap" | string;
  size: number;
  leverage?: number;
  maxSlippageBps?: number;
  memoHash?: string;
};

export type ReceiptPayload = {
  receiptId: string;
  receiptHash: string;
  plan: PlanIntent;
  reasoning?: string;
};

export type ExecutionObservation = {
  agentId: string;
  signature: string;
  venue: string;
  market: string;
  side: string;
  size: number;
  leverage?: number;
  memo?: string;
  raw: unknown;
};

export type Violation = {
  code: string;
  message: string;
};

export type PolicyDecision = {
  severity: "none" | "warning" | "critical";
  action: "allow" | "alert" | "autoRemediate";
  playbook?: "flatten_and_pause" | "warn_only";
  reason?: string;
};
