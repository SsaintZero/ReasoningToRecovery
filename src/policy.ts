import { config } from "./config";
import { PlanIntent, ExecutionObservation, PolicyDecision, Violation } from "./types";

const CRITICAL_CODES = new Set(["VENUE_MISMATCH", "SIDE_MISMATCH"]);

export function diffPlan(plan: PlanIntent, exec: ExecutionObservation): Violation[] {
  const violations: Violation[] = [];

  if (plan.venue && exec.venue && plan.venue !== exec.venue) {
    violations.push({ code: "VENUE_MISMATCH", message: `Expected venue ${plan.venue} but saw ${exec.venue}` });
  }

  if (plan.side && exec.side && plan.side !== exec.side) {
    violations.push({ code: "SIDE_MISMATCH", message: `Plan side ${plan.side} vs execution ${exec.side}` });
  }

  const sizeDelta = Math.abs(exec.size - plan.size) / (plan.size || 1);
  if (sizeDelta > config.policy.notionalTolerance) {
    violations.push({ code: "SIZE_BREACH", message: `Execution size ${exec.size} deviates ${Math.round(sizeDelta * 100)}% from plan ${plan.size}` });
  }

  if (plan.leverage && exec.leverage) {
    const leverageDelta = Math.abs(exec.leverage - plan.leverage) / plan.leverage;
    if (leverageDelta > config.policy.leverageTolerance) {
      violations.push({ code: "LEVERAGE_BREACH", message: `Leverage ${exec.leverage} vs plan ${plan.leverage}` });
    }
  }

  if (plan.memoHash && exec.memo && !exec.memo.includes(plan.memoHash)) {
    violations.push({ code: "ATTESTATION_MISSING", message: "Execution memo does not reference reasoning hash" });
  }

  return violations;
}

export function evaluatePolicy(violations: Violation[]): PolicyDecision {
  if (violations.length === 0) {
    return { severity: "none", action: "allow" };
  }

  const critical = violations.some((v) => CRITICAL_CODES.has(v.code));
  if (critical) {
    return {
      severity: "critical",
      action: "autoRemediate",
      playbook: "flatten_and_pause",
      reason: violations.map((v) => v.code).join(","),
    };
  }

  return {
    severity: "warning",
    action: "alert",
    playbook: "warn_only",
    reason: violations.map((v) => v.code).join(","),
  };
}
