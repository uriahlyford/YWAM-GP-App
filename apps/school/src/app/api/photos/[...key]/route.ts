import { prisma } from "@/lib/db";
import { getAuth, visibleStudentWhere } from "@/lib/auth/context";
import { etagFor, get } from "@/lib/storage";

/**
 * The only way a student photograph leaves the server.
 *
 * Three checks, in order: there is a session; the key belongs to a student the
 * caller is allowed to see; the object exists. A teacher who somehow learns the
 * key of a child in another class still gets a 404 — the same answer as for a
 * key that was never real, so the response can't be used to probe.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/photos/[...key]">,
) {
  const auth = await getAuth();
  if (!auth) return new Response(null, { status: 404 });

  const { key: segments } = await params;
  const key = segments.join("/");

  const scope = await visibleStudentWhere(auth);
  const student = await prisma.student.findFirst({
    where: { ...scope, photoKey: key },
    select: { id: true },
  });
  if (!student) return new Response(null, { status: 404 });

  const object = await get(key);
  if (!object) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(object.body), {
    headers: {
      "Content-Type": object.contentType,
      "Content-Length": String(object.body.byteLength),
      ETag: etagFor(object.body),
      // Private: a shared cache must never hold a child's photograph, and the
      // browser must re-check that this session still has access.
      "Cache-Control": "private, no-cache, max-age=0, must-revalidate",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
