import "server-only";
import { hash, verify } from "@node-rs/argon2";

/**
 * `Algorithm.Argon2id`. Spelled as a literal because the library declares it as
 * an ambient const enum, which `isolatedModules` cannot read at runtime.
 */
const ARGON2ID = 2;

/**
 * OWASP's argon2id baseline: 19 MiB of memory, two passes, one lane. The memory
 * cost is what makes a stolen password table expensive to attack with GPUs, and
 * 19 MiB stays inside the memory limit of a serverless invocation.
 */
const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * A real argon2id hash of 32 random bytes that were then discarded, so no input
 * verifies against it. Used to spend the same CPU on a username that doesn't
 * exist as on one that does — otherwise response time tells an attacker which of
 * a school's usernames are real. It has to be a *valid* hash: a malformed one
 * would be rejected instantly and the timing signal would come straight back.
 */
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$d3jwywa+E6hJ2gLFDz9iGw$06sf94wV0YwUYAzQqvHiBokx6POhMe34iCO6cqLveqU";

export const MIN_PASSWORD_LENGTH = 10;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(
  storedHash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plain, OPTIONS);
  } catch {
    // A malformed hash in the database is a failed sign-in, not a crash.
    return false;
  }
}

/** Burn equivalent time when there is no user to check against. */
export async function fakeVerify(plain: string): Promise<void> {
  await verifyPassword(DUMMY_HASH, plain);
}

export type PasswordProblem = "tooShort" | "tooCommon";

const OBVIOUS = new Set([
  "password12",
  "password123",
  "1234567890",
  "12345678901",
  "qwertyuiop",
  "school1234",
  "teacher123",
]);

export function checkPasswordStrength(plain: string): PasswordProblem | null {
  if (plain.length < MIN_PASSWORD_LENGTH) return "tooShort";
  if (OBVIOUS.has(plain.toLowerCase())) return "tooCommon";
  return null;
}
