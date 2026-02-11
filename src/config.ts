import path from "path";

export const config = {
  port: Number(process.env.R2R_PORT) || 8787,
  dbPath: process.env.R2R_DB_PATH || path.resolve(process.cwd(), "r2r.sqlite"),
  policy: {
    leverageTolerance: Number(process.env.R2R_LEVERAGE_TOLERANCE || 0.2),
    notionalTolerance: Number(process.env.R2R_NOTIONAL_TOLERANCE || 0.15),
  },
  telegram: {
    enabled: Boolean(process.env.R2R_TELEGRAM_TOKEN) && Boolean(process.env.R2R_TELEGRAM_CHAT),
    botToken: process.env.R2R_TELEGRAM_TOKEN || "",
    chatId: process.env.R2R_TELEGRAM_CHAT || "",
  },
  agentWallet: {
    username: process.env.AGENTWALLET_USERNAME || "precioussilas100",
    address: process.env.AGENTWALLET_SOLANA || "9RrPnkM3ZZ2E5bDAsAJnLnW1Lu9oEq4djTNRry7mSPBm",
  },
};
