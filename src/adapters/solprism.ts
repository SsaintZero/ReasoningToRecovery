import { z } from "zod";
import { ReceiptPayload } from "../types";

const numberish = z
  .union([z.number(), z.string()])
  .transform((value) => (typeof value === "string" ? Number(value) : value));

const solPrismPlanSchema = z.object({
  venue: z.string(),
  market: z.string(),
  side: z.string(),
  size: numberish,
  leverage: numberish.optional(),
  max_slippage_bps: numberish.optional(),
  memo_hash: z.string().optional(),
});

const solPrismReceiptSchema = z.object({
  receipt_id: z.string(),
  agent_id: z.string(),
  reasoning_hash: z.string(),
  plan: solPrismPlanSchema,
  reasoning: z.string().optional(),
});

export function normalizeSolPrismReceipt(input: unknown): ReceiptPayload {
  const parsed = solPrismReceiptSchema.parse(input);
  const plan = parsed.plan;

  return {
    receiptId: parsed.receipt_id,
    receiptHash: parsed.reasoning_hash,
    plan: {
      agentId: parsed.agent_id,
      venue: plan.venue,
      market: plan.market,
      side: plan.side,
      size: plan.size,
      leverage: plan.leverage,
      maxSlippageBps: plan.max_slippage_bps,
      memoHash: plan.memo_hash ?? parsed.reasoning_hash,
    },
    reasoning: parsed.reasoning,
  };
}
