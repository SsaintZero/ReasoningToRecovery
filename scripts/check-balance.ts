import { getExplorerLink } from "@solana-developers/helpers";
import { Connection, PublicKey } from "@solana/web3.js";

async function main() {
  const address = process.argv[2] ?? "85ruf5QRTW9jELMexTCm2eqXVdebDmB12exm87SWabXm";
  const connection = new Connection(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
  const pubkey = new PublicKey(address);
  const balanceLamports = await connection.getBalance(pubkey, "confirmed");
  const sol = balanceLamports / 1_000_000_000;
  console.log(JSON.stringify({
    address,
    balanceLamports,
    sol,
    explorer: getExplorerLink("address", pubkey, "devnet"),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
