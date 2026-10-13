import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key() {
  const encoded = process.env.INTEGRATION_ENCRYPTION_KEY || "";
  const value = Buffer.from(encoded, "base64");
  if (value.length !== 32) throw new Error("INTEGRATION_ENCRYPTION_KEY must be a 32-byte base64 key");
  return value;
}

export function encryptToken(token: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), nonce);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptToken(encoded: string) {
  const value = Buffer.from(encoded, "base64");
  if (value.length < 29) throw new Error("Invalid encrypted token");
  const decipher = createDecipheriv("aes-256-gcm", key(), value.subarray(0, 12));
  decipher.setAuthTag(value.subarray(12, 28));
  return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString("utf8");
}
