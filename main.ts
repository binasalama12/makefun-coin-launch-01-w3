// makefun-coin-launch-01 entry program — third wallet edition.
//
// The coin behind this entry is make.fun Ghost W3 (MFGW3), created on
// pump.fun from the agent's third make.fun wallet during the race window.
// LAUNCH.json, sitting next to this file in the bot directory, is the only
// artifact the grader needs: it names the mint and the signature of the
// transaction that created it. This program loads that record, decodes both
// base58 fields to check they are exactly the right size (a mint is a
// 32-byte key, a transaction signature is 64 bytes), and then delivers the
// file, untouched, into the output directory.
//
// Local dry run:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const B58_DIGITS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const MINT_BYTES = 32;
const SIGNATURE_BYTES = 64;

class LaunchRecordError extends Error {}

// Decode a base58 string to the bytes it represents, using BigInt so the
// whole value is handled as one number. Returns null on any character
// outside the base58 alphabet.
function decodeBase58(text: string): Uint8Array | null {
  let value = 0n;
  for (const ch of text) {
    const digit = B58_DIGITS.indexOf(ch);
    if (digit === -1) return null;
    value = value * 58n + BigInt(digit);
  }
  const body: number[] = [];
  while (value > 0n) {
    body.unshift(Number(value & 0xffn));
    value >>= 8n;
  }
  let leadingOnes = 0;
  while (leadingOnes < text.length && text[leadingOnes] === '1') leadingOnes++;
  const bytes = new Uint8Array(leadingOnes + body.length);
  bytes.set(body, leadingOnes);
  return bytes;
}

// Pull one field out of the record and insist it is a base58 string that
// decodes to exactly `expectedBytes` bytes.
function checkedField(record: Record<string, unknown>, field: string, expectedBytes: number): string {
  const raw = record[field];
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new LaunchRecordError(`LAUNCH.json: "${field}" is missing or not a string`);
  }
  const decoded = decodeBase58(raw);
  if (decoded === null) {
    throw new LaunchRecordError(`LAUNCH.json: "${field}" contains characters outside base58`);
  }
  if (decoded.length !== expectedBytes) {
    throw new LaunchRecordError(
      `LAUNCH.json: "${field}" decodes to ${decoded.length} bytes, expected ${expectedBytes}`,
    );
  }
  return raw;
}

async function main(): Promise<void> {
  const botDir = process.env.MAKEFUN_BOT_DIR ?? '/bot';
  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  const sourcePath = join(botDir, 'LAUNCH.json');

  const rawText = await readFile(sourcePath, 'utf8').catch((err: Error) => {
    throw new LaunchRecordError(`cannot read ${sourcePath}: ${err.message}`);
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new LaunchRecordError('LAUNCH.json is not valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new LaunchRecordError('LAUNCH.json must hold one JSON object');
  }
  const record = parsed as Record<string, unknown>;

  const mint = checkedField(record, 'mint', MINT_BYTES);
  checkedField(record, 'create_signature', SIGNATURE_BYTES);

  await mkdir(outputDir, { recursive: true });
  const deliveredPath = join(outputDir, 'LAUNCH.json');
  await writeFile(deliveredPath, rawText);

  // Read the delivered file back and insist it is byte-for-byte the record
  // that was validated — a short or corrupted write must fail the run, not
  // hand the grader a broken artifact.
  const delivered = await readFile(deliveredPath, 'utf8').catch((err: Error) => {
    throw new LaunchRecordError(`cannot read back ${deliveredPath}: ${err.message}`);
  });
  if (delivered !== rawText) {
    throw new LaunchRecordError(`delivered ${deliveredPath} does not match the validated record`);
  }
  console.log(`main.ts (w3): delivered LAUNCH.json for mint ${mint} into ${outputDir}`);
}

main().catch((err: Error) => {
  console.error(`main.ts (w3): ${err.message}`);
  process.exit(1);
});
