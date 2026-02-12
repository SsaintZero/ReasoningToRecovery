import crypto from "crypto";
import { PolicyDecision, PlanIntent, ExecutionObservation, Violation } from "./types";
import { closePositions } from "./integrations/drift";
import { pauseAgentWallet } from "./integrations/agentwallet";
import { anchorEvidenceMemo } from "./integrations/solana";

export type RemediationResult = {
  steps: Array<{ description: string; status: "ok" | "skipped" | "error"; detail?: string }>;
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
  let memoSignature: string | undefined;

  if (decision.playbook === "flatten_and_pause") {
    const driftResult = await closePositions({
      agentId: plan.agentId,
      market: execution.market,
      size: execution.size,
    });
    steps.push({
      description: "Drift close_positions",
      status: driftResult.ok ? "ok" : "error",
      detail: driftResult.detail,
    });

    const pauseResult = await pauseAgentWallet(decision.reason ?? "policy-breach");
    steps.push({
      description: "AgentWallet policy pause",
      status: pauseResult.ok ? "ok" : "error",
      detail: pauseResult.detail,
    });

    const memoResult = await anchorEvidenceMemo(JSON.stringify({
      hash: evidenceHash,
      agentId: plan.agentId,
      signature: execution.signature,
    }));
    memoSignature = memoResult.signature;
    steps.push({
      description: "Anchor memo on Solana",
      status: memoResult.ok ? "ok" : memoResult.detail === "no-keypair" ? "skipped" : "error",
      detail: memoResult.signature ?? memoResult.detail,
    });
  } else {
    steps.push({ description: "Warn only – no remediation required", status: "skipped" });
  }

  return {
    steps,
    evidenceHash,
    memoSignature,
  };
}
