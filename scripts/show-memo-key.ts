import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import fs from "fs";
import path from "path";

const base58Path = path.resolve(process.cwd(), "secrets", "r2r-memo-keypair.base58");
const secretPath = path.resolve(process.cwd(), "secrets", "r2r-memo-keypair.json");

let secretKey: Uint8Array;
if (fs.existsSync(base58Path)) {
  const content = fs.readFileSync(base58Path, "utf8").trim();
  secretKey = bs58.decode(content);
} else {
  const arr = JSON.parse(fs.readFileSync(secretPath, "utf8"));
  secretKey = new Uint8Array(arr);
}

const keypair = Keypair.fromSecretKey(secretKey);
console.log(JSON.stringify({
  publicKey: keypair.publicKey.toBase58(),
  secretBase58Path: base58Path,
  secretJsonPath: secretPath,
}, null, 2));
