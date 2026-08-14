import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Object storage for student photos.
 *
 * Photographs of children are the most sensitive thing this application holds,
 * so they are never written anywhere a URL can reach. A stored object has an
 * opaque key; the only way to read one back is through the authorised route at
 * `/api/photos/[key]`, which checks the caller's session and their access to
 * that particular student first.
 *
 * The driver below writes to the local filesystem, which is right for a VPS or
 * a container with a mounted volume. On a serverless host the filesystem is
 * ephemeral — point `STORAGE_DIR` at a persistent volume, or implement `put`,
 * `get` and `remove` against a bucket. Nothing above this file knows which it
 * is talking to.
 */

export type StoredObject = { body: Buffer; contentType: string };

const ROOT = path.resolve(process.env.STORAGE_DIR ?? ".storage");

/** 2 MB. A phone camera easily exceeds this, so the form says so up front. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export const ALLOWED_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Keys are random, not derived from the student. A guessable key would let
 * anyone who learns one student's key walk the others.
 */
export function newPhotoKey(contentType: string): string {
  const ext = EXTENSIONS[contentType] ?? "bin";
  return `photos/${randomBytes(16).toString("hex")}.${ext}`;
}

/** Rejects anything trying to climb out of the storage root. */
function resolveKey(key: string): string {
  const full = path.resolve(ROOT, key);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return full;
}

export async function put(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body);
  await writeFile(`${full}.type`, contentType, "utf8");
}

export async function get(key: string): Promise<StoredObject | null> {
  try {
    const full = resolveKey(key);
    const [body, contentType] = await Promise.all([
      readFile(full),
      readFile(`${full}.type`, "utf8").catch(() => "application/octet-stream"),
    ]);
    return { body, contentType: contentType.trim() };
  } catch {
    return null;
  }
}

export async function remove(key: string): Promise<void> {
  try {
    const full = resolveKey(key);
    await unlink(full);
    await unlink(`${full}.type`).catch(() => {});
  } catch {
    // A missing object is the desired end state either way.
  }
}

/** Weak validator for cache revalidation on the photo route. */
export function etagFor(body: Buffer): string {
  return `"${createHash("sha1").update(body).digest("hex")}"`;
}
