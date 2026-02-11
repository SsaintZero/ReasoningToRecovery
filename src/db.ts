import { Database } from "bun:sqlite";
import { config } from "./config";

export const db = new Database(config.dbPath, { create: true });

db.run(`
CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  receipt_hash TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  reasoning TEXT,
  created_at TEXT NOT NULL
);
`);

db.run(`
CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  signature TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

db.run(`
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  receipt_id TEXT,
  execution_id TEXT,
  severity TEXT NOT NULL,
  policy_trigger TEXT,
  playbook TEXT,
  status TEXT NOT NULL,
  violations_json TEXT NOT NULL,
  remediation_json TEXT,
  memo_signature TEXT,
  evidence_hash TEXT,
  created_at TEXT NOT NULL
);
`);

export type ReceiptRow = {
  id: string;
  agent_id: string;
  receipt_hash: string;
  plan_json: string;
  reasoning: string | null;
  created_at: string;
};

export function insertReceipt(row: ReceiptRow) {
  db.query(
    `INSERT INTO receipts (id, agent_id, receipt_hash, plan_json, reasoning, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(row.id, row.agent_id, row.receipt_hash, row.plan_json, row.reasoning, row.created_at);
}

export function fetchRecentReceipt(agentId: string): ReceiptRow | undefined {
  return db
    .query(
      `SELECT * FROM receipts WHERE agent_id = ? ORDER BY datetime(created_at) DESC LIMIT 1`
    )
    .get(agentId) as ReceiptRow | undefined;
}

export function insertExecution(row: {
  id: string;
  agent_id: string;
  signature: string;
  payload_json: string;
  created_at: string;
}) {
  db.query(
    `INSERT OR IGNORE INTO executions (id, agent_id, signature, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(row.id, row.agent_id, row.signature, row.payload_json, row.created_at);
}

export type IncidentRow = {
  id: string;
  agent_id: string;
  receipt_id?: string;
  execution_id?: string;
  severity: string;
  policy_trigger?: string;
  playbook?: string;
  status: string;
  violations_json: string;
  remediation_json?: string;
  memo_signature?: string;
  evidence_hash?: string;
  created_at: string;
};

export function insertIncident(row: {
  id: string;
  agent_id: string;
  receipt_id?: string;
  execution_id?: string;
  severity: string;
  policy_trigger?: string;
  playbook?: string;
  status: string;
  violations_json: string;
  remediation_json?: string;
  memo_signature?: string;
  evidence_hash?: string;
  created_at: string;
}) {
  db.query(
    `INSERT INTO incidents (
      id, agent_id, receipt_id, execution_id, severity, policy_trigger, playbook,
      status, violations_json, remediation_json, memo_signature, evidence_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.id,
    row.agent_id,
    row.receipt_id ?? null,
    row.execution_id ?? null,
    row.severity,
    row.policy_trigger ?? null,
    row.playbook ?? null,
    row.status,
    row.violations_json,
    row.remediation_json ?? null,
    row.memo_signature ?? null,
    row.evidence_hash ?? null,
    row.created_at
  );
}

export function fetchIncidents(limit = 20): IncidentRow[] {
  return db
    .query(
      `SELECT id, agent_id, receipt_id, execution_id, severity, policy_trigger, playbook,
              status, violations_json, remediation_json, memo_signature, evidence_hash, created_at
       FROM incidents ORDER BY datetime(created_at) DESC LIMIT ?`
    )
    .all(limit) as IncidentRow[];
}
