import Fastify from "fastify";
import { z } from "zod";
import { nanoid } from "nanoid";
import { config } from "./config";
import {
  insertReceipt,
  fetchRecentReceipt,
  insertExecution,
  insertIncident,
  fetchIncidents,
} from "./db";
import { diffPlan, evaluatePolicy } from "./policy";
import { runPlaybook } from "./orchestrator";
import { sendAlert } from "./alerts";
import { PlanIntent, ExecutionObservation } from "./types";

const app = Fastify({ logger: true });

const planSchema = z.object({
  agentId: z.string(),
  venue: z.string(),
  market: z.string(),
  side: z.string(),
  size: z.number().positive(),
  leverage: z.number().positive().optional(),
  maxSlippageBps: z.number().nonnegative().optional(),
  memoHash: z.string().optional(),
});

const receiptSchema = z.object({
  receiptId: z.string().optional(),
  receiptHash: z.string(),
  agentId: z.string(),
  plan: planSchema,
  reasoning: z.string().optional(),
});

const executionSchema = z.object({
  agentId: z.string(),
  signature: z.string(),
  venue: z.string(),
  market: z.string(),
  side: z.string(),
  size: z.number().positive(),
  leverage: z.number().positive().optional(),
  memo: z.string().optional(),
  raw: z.any().optional(),
});

app.get("/health", async () => ({ status: "ok" }));

app.get("/incidents", async (request, reply) => {
  const limit = Number(request.query?.limit ?? 20);
  const rows = fetchIncidents(Number.isNaN(limit) ? 20 : limit);
  return reply.send({ incidents: rows });
});

app.post("/receipts", async (request, reply) => {
  const data = receiptSchema.parse(request.body);
  const receiptId = data.receiptId ?? nanoid();

  const payload = {
    id: receiptId,
    agent_id: data.agentId,
    receipt_hash: data.receiptHash,
    plan_json: JSON.stringify(data.plan),
    reasoning: data.reasoning ?? null,
    created_at: new Date().toISOString(),
  };

  insertReceipt(payload);
  return reply.code(201).send({ receiptId });
});

app.post("/webhooks/helius", async (request, reply) => {
  const body = executionSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({ error: body.error.flatten() });
  }

  const exec = body.data as ExecutionObservation;
  insertExecution({
    id: nanoid(),
    agent_id: exec.agentId,
    signature: exec.signature,
    payload_json: JSON.stringify(exec),
    created_at: new Date().toISOString(),
  });

  const recent = fetchRecentReceipt(exec.agentId);
  if (!recent) {
    request.log.warn({ exec }, "No recent receipt available – skipping policy evaluation");
    return reply.send({ status: "no-receipt" });
  }

  const plan = JSON.parse(recent.plan_json) as PlanIntent;
  const violations = diffPlan(plan, exec);
  const decision = evaluatePolicy(violations);

  if (decision.action === "allow") {
    return reply.send({ status: "allow" });
  }

  const remediation = await runPlaybook({ decision, plan, execution: exec, violations });

  insertIncident({
    id: nanoid(),
    agent_id: exec.agentId,
    receipt_id: recent.id,
    execution_id: exec.signature,
    severity: decision.severity,
    policy_trigger: decision.reason,
    playbook: decision.playbook,
    status: "logged",
    violations_json: JSON.stringify(violations),
    remediation_json: JSON.stringify(remediation),
    memo_signature: remediation.memoSignature,
    evidence_hash: remediation.evidenceHash,
    created_at: new Date().toISOString(),
  });

  await sendAlert(
    `R2R incident \nagent=${exec.agentId}\nsignature=${exec.signature}\nviolations=${violations
      .map((v) => v.code)
      .join(",")}\nseverity=${decision.severity}`
  );

  return reply.send({ status: "handled", decision, remediation });
});

export async function start() {
  await app.listen({ port: config.port, host: "0.0.0.0" });
}

if (import.meta.main) {
  start();
}
