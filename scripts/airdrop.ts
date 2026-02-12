import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

async function main() {
  const address = process.argv[2];
  if (!address) {
    console.error("Usage: bun run scripts/airdrop.ts <pubkey> [sol]");
    process.exit(1);
  }
  const sol = Number(process.argv[3] ?? "0.1");
  const lamports = Math.floor(sol * LAMPORTS_PER_SOL);
  const connection = new Connection(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
  const pubkey = new PublicKey(address);
  const sig = await connection.requestAirdrop(pubkey, lamports);
  const latest = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
  console.log(JSON.stringify({ sig, sol, lamports }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
