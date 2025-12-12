import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const rpc = process.env.SOLANA_RPC || 'https://api.devnet.solana.com';
const conn = new Connection(rpc, 'confirmed');

export async function verifyPaymentToWithMemo(toBase58: string, lamports: number, memo: string) {
  const to = new PublicKey(toBase58);

  const sigs = await conn.getSignaturesForAddress(to, { limit: 40 });
  for (const s of sigs) {
    const tx = await conn.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
    if (!tx) continue;

    const memoIx = tx.transaction.message.instructions.find((ix: any) => ix.program === 'spl-memo');
    const hasMemo = memoIx?.parsed === memo || memoIx?.parsed?.memo === memo;
    if (!hasMemo) continue;

    const meta = tx.meta;
    if (!meta) continue;

    const pre = meta.preBalances;
    const post = meta.postBalances;
    const accountKeys: string[] = tx.transaction.message.accountKeys.map((k: any) => k.pubkey?.toBase58?.() || k.pubkey?.toString?.() || k.toBase58?.() || String(k));

    const toIndex = accountKeys.findIndex((a) => a === toBase58);
    if (toIndex < 0) continue;

    const delta = post[toIndex] - pre[toIndex];
    if (delta === lamports) {
      return { ok: true, signature: s.signature, slot: s.slot, blockTime: tx.blockTime };
    }
  }
  return { ok: false };
}

export async function verifySignature(walletAddress: string, message: string, signature: string): Promise<boolean> {
  try {
    const publicKey = new PublicKey(walletAddress);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());
  } catch (error) {
    return false;
  }
}

export async function createPaymentTransaction(
  fromPubkey: string,
  toPubkey: string,
  lamports: number,
  memo: string
) {
  try {
    const from = new PublicKey(fromPubkey);
    const to = new PublicKey(toPubkey);
    
    const transaction = new Transaction();

    transaction.add(
      SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: to,
        lamports
      })
    );

    if (memo) {
      const memoInstruction = {
        keys: [],
        programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
        data: Buffer.from(memo, 'utf8')
      };
      transaction.add(memoInstruction);
    }

    const { blockhash } = await conn.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = from;
    
    return transaction.serialize({ requireAllSignatures: false });
  } catch (error) {
    throw error;
  }
}

export async function submitTransaction(serializedTransaction: Buffer): Promise<string> {
  try {
    const signature = await conn.sendRawTransaction(serializedTransaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });

    await conn.confirmTransaction(signature, 'confirmed');

    return signature;
  } catch (error) {
    throw error;
  }
}

export async function hasSplTokenBalance(ownerBase58: string, mintBase58: string, minAmount: number): Promise<boolean> {
  const owner = new PublicKey(ownerBase58);
  const mint = new PublicKey(mintBase58);
  const accounts = await conn.getParsedTokenAccountsByOwner(owner, { mint });
  let total = 0;
  for (const a of accounts.value) {
    const info: any = a.account.data.parsed.info;
    const amount = Number(info.tokenAmount.amount);
    const decimals = Number(info.tokenAmount.decimals);
    total += amount / Math.pow(10, decimals);
  }
  return total >= minAmount;
}

export async function ownsAnyMint(ownerBase58: string, mints: string[]): Promise<boolean> {
  for (const m of mints) {
    const ok = await hasSplTokenBalance(ownerBase58, m, 1);
    if (ok) return true;
  }
  return false;
}
