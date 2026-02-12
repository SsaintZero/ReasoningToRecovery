import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import bs58 from "bs58";
import { config } from "../config";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
let memoKeypair: Keypair | null = null;

function loadKeypair() {
  if (!config.solana.memoKeypair) {
    memoKeypair = null;
    return;
  }

  if (memoKeypair) {
    return;
  }

  try {
    if (config.solana.memoKeypair.trim().startsWith("[")) {
      const arr = JSON.parse(config.solana.memoKeypair);
      memoKeypair = Keypair.fromSecretKey(new Uint8Array(arr));
      return;
    }

    const secret = bs58.decode(config.solana.memoKeypair.trim());
    memoKeypair = Keypair.fromSecretKey(secret);
  } catch (err) {
    console.error("Failed to parse SOLANA_MEMO_KEYPAIR", err);
    memoKeypair = null;
  }
}

loadKeypair();

export async function anchorEvidenceMemo(message: string): Promise<{ ok: boolean; signature?: string; detail?: string }> {
  loadKeypair();
  if (!memoKeypair) {
    console.log(`[solana] memo skipped (no keypair configured) → ${message.slice(0, 16)}…`);
    return { ok: false, detail: "no-keypair" };
  }

  try {
    const connection = new Connection(config.solana.rpcUrl, "confirmed");
    const instruction = new TransactionInstruction({
      keys: [{ pubkey: memoKeypair.publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(message, "utf8"),
    });

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const tx = new Transaction({ feePayer: memoKeypair.publicKey, recentBlockhash: blockhash }).add(instruction);
    const signature = await connection.sendTransaction(tx, [memoKeypair], { skipPreflight: false });
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });

    return { ok: true, signature };
  } catch (err) {
    console.error("Memo anchor failed", err);
    return { ok: false, detail: err instanceof Error ? err.message : "unknown" };
  }
}
