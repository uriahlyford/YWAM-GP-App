// POST /api/auth — sign up, or sign in.
//
// Signing up needs the shared join code, so the app isn't open to the internet,
// but nothing beyond that: no email confirmation, no SMS gateway, no waiting on a
// coordinator to approve. A pastor with the code and a phone is in.
import {
  store,
  normalizePhone,
  validPin,
  hashPin,
  pinMatches,
  signToken,
  getUser,
  putUser,
  selfView,
  lockedFor,
  noteFailedPin,
  clearFailedPin,
  joinCode,
  directorPhone,
} from "../shared/auth.mjs";

function bad(error, status = 400) {
  return Response.json({ error }, { status });
}

async function signup(s, body) {
  if (String(body.joinCode || "") !== joinCode()) {
    return bad("Incorrect team code.", 401);
  }

  const phone = normalizePhone(body.phone);
  if (!phone) return bad("That doesn't look like a Cambodian phone number.");

  const name = String(body.name || "").trim().slice(0, 120);
  if (!name) return bad("Enter your name.");

  if (!validPin(body.pin)) return bad("Choose a PIN of 4 to 8 numbers.");

  const existing = await getUser(s, phone);
  if (existing) return bad("That number already has an account. Sign in instead.", 409);

  const { salt, hash } = await hashPin(body.pin);

  // The committee director is defined by their phone number in the Netlify
  // settings, so the role attaches itself the moment they sign up like anyone else.
  const role = phone === directorPhone() ? "director" : "pastor";

  const user = {
    phone,
    name,
    role,
    pinSalt: salt,
    pinHash: hash,
    provinceId: String(body.provinceId || "").trim(),
    churchName: "",
    denomination: "",
    congregation: { men: 0, women: 0, children: 0 },
    villages: [],
    createdAt: new Date().toISOString(),
  };
  await putUser(s, user);

  return Response.json({ token: await signToken(s, user), me: selfView(user) });
}

async function signin(s, body) {
  const phone = normalizePhone(body.phone);
  if (!phone) return bad("That doesn't look like a Cambodian phone number.");

  const user = await getUser(s, phone);
  // Same message either way. Telling a caller which numbers have accounts turns
  // this endpoint into a directory of the country's pastors.
  const wrong = () => bad("Wrong phone number or PIN.", 401);
  if (!user) return wrong();

  const locked = lockedFor(user);
  if (locked > 0) {
    return bad(`Too many wrong PINs. Try again in ${Math.ceil(locked / 60000)} minutes.`, 429);
  }

  if (!(await pinMatches(body.pin, user))) {
    await noteFailedPin(s, user);
    return wrong();
  }
  await clearFailedPin(s, user);

  // A director whose number was set in Netlify after they had already signed up
  // is promoted here, so the setting doesn't need them to start a new account.
  if (user.phone === directorPhone() && user.role !== "director") {
    user.role = "director";
    await putUser(s, user);
  }

  return Response.json({ token: await signToken(s, user), me: selfView(user) });
}

export default async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const s = store();
  let body;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid request body.");
  }

  if (body.action === "signup") return signup(s, body);
  if (body.action === "signin") return signin(s, body);
  return bad("Unknown action.");
};

export const config = { path: "/api/auth" };
