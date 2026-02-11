import crypto from "crypto";
import { config } from "./config";
import { PolicyDecision, PlanIntent, ExecutionObservation, Violation } from "./types";

export type RemediationResult = {
  steps: Array<{ description: string; status: "ok" | "skipped" }>; 
  memoSignature?: string;
  evidenceHash: string;
};

export async function runPlaybook(params: {
  decision: PolicyDecision;
  plan: PlanIntent;
  execution: ExecutionObservation;
  violations: Violation[];
}): Promise<RemediationResult> {
  const { decision, plan, execution, violations } = params;
  const evidencePayload = {
    timestamp: new Date().toISOString(),
    decision,
    plan,
    execution,
    violations,
  };
  const evidenceHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(evidencePayload))
    .digest("hex");

  const steps: RemediationResult["steps"] = [];

  if (decision.playbook === "flatten_and_pause") {
    steps.push({ description: "Simulate Drift close_positions", status: "ok" });
    steps.push({ description: "Simulate AgentWallet policy pause", status: "ok" });
    steps.push({ description: "Simulate memo anchor on Solana", status: "ok" });
  } else {
    steps.push({ description: "Warn only – no remediation required", status: "skipped" });
  }

  return {
    steps,
    evidenceHash,
    memoSignature: decision.playbook === "flatten_and_pause" ? `SIMULATED-${Date.now()}` : undefined,
  };
}
