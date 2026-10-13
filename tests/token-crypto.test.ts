import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { decryptToken, encryptToken } from "../lib/token-crypto.ts";

test("tokens de integração são criptografados e autenticados", () => {
  const old = process.env.INTEGRATION_ENCRYPTION_KEY;
  process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  try {
    const secret = "ntn_token_personal_123";
    const first = encryptToken(secret);
    const second = encryptToken(secret);
    assert.notEqual(first, secret);
    assert.notEqual(first, second);
    assert.equal(decryptToken(first), secret);
    const tampered = Buffer.from(first, "base64");
    tampered[tampered.length - 1] ^= 1;
    assert.throws(() => decryptToken(tampered.toString("base64")));
  } finally {
    if (old === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
    else process.env.INTEGRATION_ENCRYPTION_KEY = old;
  }
});
