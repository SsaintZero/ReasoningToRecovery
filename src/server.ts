import crypto from "crypto";
import Fastify, { FastifyRequest } from "fastify";
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
import { normalizeSolPrismReceipt } from "./adapters/solprism";

const app = Fastify({ logger: true });

app.addContentTypeParser("application/json", { parseAs: "string" }, (request, payload, done) => {
  try {
    (request as FastifyRequest & { rawBody?: string }).rawBody = payload;
    const json = JSON.parse(payload);
    done(null, json);
  } catch (err) {
    done(err as Error);
  }
});

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

type RawBodyRequest = FastifyRequest & { rawBody?: string };

function persistReceiptRecord(args: {
  receiptId?: string;
  receiptHash: string;
  agentId: string;
  plan: PlanIntent;
  reasoning?: string;
}) {
  const receiptId = args.receiptId ?? nanoid();
  insertReceipt({
    id: receiptId,
    agent_id: args.agentId,
    receipt_hash: args.receiptHash,
    plan_json: JSON.stringify(args.plan),
    reasoning: args.reasoning ?? null,
    created_at: new Date().toISOString(),
  });
  return receiptId;
}

function verifyHeliusSignature(request: RawBodyRequest) {
  if (!config.helius.secret) {
    return true;
  }
  const signature = request.headers["x-helius-signature"] as string | undefined;
  const rawBody = request.rawBody;
  if (!signature || !rawBody) {
    return false;
  }
  const expected = crypto.createHmac("sha256", config.helius.secret).update(rawBody).digest("base64");
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(signature);
  return (
    expectedBuf.length === providedBuf.length &&
    crypto.timingSafeEqual(expectedBuf, providedBuf)
  );
}

app.get("/health", async () => ({ status: "ok" }));

app.get("/incidents", async (request, reply) => {
  const limit = Number(request.query?.limit ?? 20);
  const rows = fetchIncidents(Number.isNaN(limit) ? 20 : limit);
  return reply.send({ incidents: rows });
});

app.post("/receipts", async (request, reply) => {
  const data = receiptSchema.parse(request.body);
  const receiptId = persistReceiptRecord({
    receiptId: data.receiptId,
    receiptHash: data.receiptHash,
    agentId: data.agentId,
    plan: data.plan,
    reasoning: data.reasoning ?? undefined,
  });
  return reply.code(201).send({ receiptId });
});

app.post("/receipts/solprism", async (request, reply) => {
  const normalized = normalizeSolPrismReceipt(request.body);
  const receiptId = persistReceiptRecord({
    receiptId: normalized.receiptId,
    receiptHash: normalized.receiptHash,
    agentId: normalized.plan.agentId,
    plan: normalized.plan,
    reasoning: normalized.reasoning,
  });
  return reply.code(201).send({ receiptId });
});

app.post("/webhooks/helius", async (request, reply) => {
  if (!verifyHeliusSignature(request as RawBodyRequest)) {
    request.log.warn("Invalid Helius signature");
    return reply.code(401).send({ error: "invalid-signature" });
  }

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
