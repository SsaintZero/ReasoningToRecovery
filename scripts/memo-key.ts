import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import fs from "fs";
import path from "path";

async function main() {
  const outputDir = path.resolve(process.cwd(), "secrets");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "r2r-memo-keypair.json");
  const base58Path = path.join(outputDir, "r2r-memo-keypair.base58");

  const keypair = Keypair.generate();
  const secretArray = Array.from(keypair.secretKey);
  fs.writeFileSync(outputPath, JSON.stringify(secretArray));
  fs.writeFileSync(base58Path, bs58.encode(keypair.secretKey));

  const connection = new Connection(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
  const lamports = Number(process.env.MEMO_AIRDROP_SOL ?? 2) * LAMPORTS_PER_SOL;
  const sig = await connection.requestAirdrop(keypair.publicKey, lamports);
  const latest = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");

  const balance = await connection.getBalance(keypair.publicKey, "confirmed");

  console.log(JSON.stringify({
    publicKey: keypair.publicKey.toBase58(),
    secretPath: outputPath,
    secretBase58Path: base58Path,
    lamports,
    sol: lamports / LAMPORTS_PER_SOL,
    signature: sig,
    balance: balance / LAMPORTS_PER_SOL,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
