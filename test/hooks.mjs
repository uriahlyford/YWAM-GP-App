// Swaps @netlify/blobs for the in-memory stand-in, so the real function handlers
// can run outside Netlify without being changed to suit the test.
const MOCK = new URL("./mock-blobs.mjs", import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === "@netlify/blobs") return { url: MOCK, shortCircuit: true };
  return next(specifier, context);
}
