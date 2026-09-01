const B = "http://localhost:" + (process.env.PORT || 8901);
let fails = 0;
const ok = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) fails++; };
const J = async (p, o = {}) => {
  const r = await fetch(B + p, o);
  let j = null;
  try { j = await r.json(); } catch {}
  return { status: r.status, j };
};
const post = (p, body, token) => J(p, {
  method: "POST",
  headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
  body: JSON.stringify(body),
});
const put = (p, body, token) => J(p, {
  method: "PUT",
  headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
  body: JSON.stringify(body),
});
const get = (p, token) => J(p, { headers: token ? { authorization: "Bearer " + token } : {} });

console.log("--- signup gate ---");
let r = await post("/api/auth", { action: "signup", phone: "012 300 001", name: "Sok Dara", pin: "1234", joinCode: "wrong" });
ok("wrong team code rejected", r.status === 401);
r = await post("/api/auth", { action: "signup", phone: "12", name: "X", pin: "1234", joinCode: "cambodia2033" });
ok("bad phone rejected", r.status === 400);
r = await post("/api/auth", { action: "signup", phone: "012 300 001", name: "Sok Dara", pin: "12", joinCode: "cambodia2033" });
ok("2-digit PIN rejected", r.status === 400);
r = await post("/api/auth", { action: "signup", phone: "012 300 001", name: "", pin: "1234", joinCode: "cambodia2033" });
ok("empty name rejected", r.status === 400);

console.log("\n--- three pastors in Kampot, one in Takeo ---");
const mk = async (phone, name, provinceId) => {
  const r = await post("/api/auth", { action: "signup", phone, name, pin: "1234", joinCode: "cambodia2033", provinceId });
  if (r.status !== 200) throw new Error("signup failed " + name + " " + JSON.stringify(r.j));
  return r.j.token;
};
const daraTok = await mk("012 300 001", "Sok Dara", "kampot");
const boraTok = await mk("012 300 002", "Chan Bora", "kampot");
const vannTok = await mk("097 3000 003", "Kim Vann", "kampot");
const takeoTok = await mk("012 300 004", "Meas Sophal", "takeo");
ok("four accounts created", [daraTok, boraTok, vannTok, takeoTok].every(Boolean));

r = await post("/api/auth", { action: "signup", phone: "+855 12 300 001", name: "Impostor", pin: "9999", joinCode: "cambodia2033" });
ok("same number in another format can't re-register", r.status === 409);

console.log("\n--- signin ---");
r = await post("/api/auth", { action: "signin", phone: "+855 12 300 001", pin: "1234" });
ok("signs in with the international spelling of the same number", r.status === 200 && r.j.me.name === "Sok Dara");
r = await post("/api/auth", { action: "signin", phone: "012 300 001", pin: "0000" });
ok("wrong PIN rejected", r.status === 401);
r = await post("/api/auth", { action: "signin", phone: "012 999 999", pin: "1234" });
ok("unknown number gives the same 401, not a hint", r.status === 401 && r.j.error === "Wrong phone number or PIN.");

console.log("\n--- congregation profiles ---");
r = await put("/api/me", {
  churchName: "Grace Church Chhuk", denomination: "Cambodian Evangelical Church",
  provinceId: "kampot", congregation: { men: 40, women: 55, children: 30 },
  villages: [{ code: "07050101", name: "Thmei" }, { code: "07050102", name: "Kandaol" }],
}, daraTok);
ok("profile saved", r.status === 200 && r.j.me.congregationTotal === 125);
await put("/api/me", { provinceId: "kampot", congregation: { men: 20, women: 30, children: 25 } }, boraTok);
await put("/api/me", { provinceId: "kampot", congregation: { men: 10, women: 12, children: 8 } }, vannTok);
await put("/api/me", { provinceId: "takeo", congregation: { men: 100, women: 120, children: 90 } }, takeoTok);

r = await put("/api/me", { congregation: { men: -5, women: 0, children: 0 } }, daraTok);
ok("negative congregation rejected", r.status === 400);
r = await put("/api/me", { congregation: { men: 999999, women: 0, children: 0 } }, daraTok);
ok("absurd congregation rejected", r.status === 400);
r = await put("/api/me", { villages: Array.from({ length: 500 }, (_, i) => ({ code: "c" + i, name: "V" + i })) }, daraTok);
ok("village list capped at 200", r.status === 200 && r.j.me.villages.length === 200);
await put("/api/me", { villages: [{ code: "07050101", name: "Thmei" }, { code: "07050101", name: "Dup" }] }, daraTok);
r = await get("/api/me", daraTok);
ok("duplicate village codes collapse to one", r.j.me.villages.length === 1);

console.log("\n--- privacy: a pastor sees only their leader and the director ---");
r = await get("/api/me", boraTok);
ok("pastor gets no roster", r.j.roster === undefined);
ok("pastor is told no leader is named yet", r.j.leaderMissing === true && r.j.leader === null);
ok("no director yet either", r.j.director === null);
const raw = JSON.stringify(r.j);
ok("another pastor's number is not in the payload at all", !raw.includes("855123000 01".replace(" ", "")) && !raw.includes("85512300001"));
ok("no PIN material anywhere in the payload", !raw.includes("pinHash") && !raw.includes("pinSalt"));

console.log("\n--- the director ---");
const dirTok = await mk("012 111 222", "Committee Director", "phnom-penh");
r = await get("/api/me", dirTok);
ok("DIRECTOR_PHONE holder is a director on signup", r.j.me.role === "director");
ok("director sees every church", r.j.rosterScope === "all" && r.j.roster.length === 5);
ok("director's tally covers both provinces", r.j.tally.kampot.total === 230 && r.j.tally.takeo.total === 310);
ok("kampot counts 3 reporting churches", r.j.tally.kampot.churches === 3);
ok("director roster still carries no PIN material", !JSON.stringify(r.j.roster).includes("pinHash"));

console.log("\n--- a pastor cannot promote anyone ---");
r = await post("/api/me", { action: "setRole", phone: "012 300 002", role: "leader" }, boraTok);
ok("pastor promoting themselves is refused", r.status === 403);
r = await post("/api/me", { action: "setRole", phone: "012 300 001", role: "director" }, dirTok);
ok("even the director cannot mint another director", r.status === 400);
r = await post("/api/me", { action: "setRole", phone: "012 300 001", role: "leader" }, dirTok);
ok("director names Kampot's provincial leader", r.status === 200);

console.log("\n--- what the leader can now see ---");
r = await get("/api/me", daraTok);
ok("role is now leader", r.j.me.role === "leader");
ok("leader sees a province-scoped roster", r.j.rosterScope === "province" && r.j.roster.length === 3);
ok("roster carries the men/women/children split", r.j.roster.some((x) => x.congregation.women === 30));
ok("leader's tally is their province only", r.j.tally.kampot.total === 230 && r.j.tally.takeo === undefined);
ok("leader sees the director's number", r.j.director && r.j.director.phoneDisplay === "012 111 222");
r = await get("/api/me", boraTok);
ok("a Kampot pastor now sees their leader's number", r.j.leader && r.j.leader.phoneDisplay === "012 300 001");
ok("...and their leader's church", r.j.leader.churchName === "Grace Church Chhuk");
r = await get("/api/me", takeoTok);
ok("a Takeo pastor does NOT get Kampot's leader", r.j.leader === null && r.j.leaderMissing === true);

console.log("\n--- one leader per province ---");
r = await post("/api/me", { action: "setRole", phone: "012 300 002", role: "leader" }, dirTok);
ok("naming a second leader succeeds", r.status === 200);
r = await get("/api/me", dirTok);
const kampotLeaders = r.j.roster.filter((x) => x.provinceId === "kampot" && x.role === "leader");
ok("the previous leader was demoted — exactly one leader in Kampot", kampotLeaders.length === 1 && kampotLeaders[0].phone === "85512300002");
r = await get("/api/me", daraTok);
ok("the demoted leader loses the roster immediately", r.j.roster === undefined && r.j.me.role === "pastor");

console.log("\n--- province reports ---");
r = await post("/api/entries", { provinceId: "kampot", provinceName: "Kampot", christians: 9000, villagesWithChurches: 40, confidence: 7 }, daraTok);
ok("a demoted pastor cannot send the province total", r.status === 403);
r = await post("/api/entries", { provinceId: "kampot", provinceName: "Kampot", christians: 9000, villagesWithChurches: 40, confidence: 7 }, boraTok);
ok("the current leader can, with no passcode", r.status === 200);
ok("the report records who sent it", r.j.entry.enteredBy === "Chan Bora" && r.j.entry.enteredByPhone === "85512300002");
r = await post("/api/entries", { provinceId: "takeo", provinceName: "Takeo", christians: 100, villagesWithChurches: 1, confidence: 5 }, boraTok);
ok("a leader cannot report for someone else's province", r.status === 403);
r = await post("/api/entries", { provinceId: "takeo", provinceName: "Takeo", christians: 100, villagesWithChurches: 1, confidence: 5 }, dirTok);
ok("the director can report for any province", r.status === 200);
r = await post("/api/entries", { provinceId: "kampot", provinceName: "Kampot", christians: 50, villagesWithChurches: 2, confidence: 5, passcode: "cambodia2033" });
ok("the old shared-passcode path still works", r.status === 200);
r = await post("/api/entries", { provinceId: "kampot", provinceName: "Kampot", christians: 50, villagesWithChurches: 2, confidence: 5, passcode: "nope" });
ok("a wrong passcode is still refused", r.status === 401);
r = await post("/api/entries", { provinceId: "kep", provinceName: "Kep", christians: 10, villagesWithChurches: 99, confidence: 5, passcode: "cambodia2033" });
ok("more churches than Kep has villages is refused", r.status === 400);

console.log("\n--- village ticks ---");
r = await post("/api/villages", { provinceId: "kampot", villageCode: "07050101", hasChurch: true }, vannTok);
ok("any signed-in pastor can tick a village", r.status === 200);
r = await post("/api/villages", { provinceId: "kampot", villageCode: "07050102", hasChurch: true });
ok("an unsigned request with no passcode is refused", r.status === 401);
r = await get("/api/villages?province=kampot");
ok("the tick is recorded against the pastor's name", r.j.statuses["07050101"].updatedBy === "Kim Vann");

console.log("\n--- PIN change ---");
r = await put("/api/me", { currentPin: "0000", newPin: "5678" }, boraTok);
ok("wrong current PIN refused", r.status === 401);
r = await put("/api/me", { currentPin: "1234", newPin: "5678" }, boraTok);
ok("PIN changed", r.status === 200 && r.j.pinChanged);
r = await post("/api/auth", { action: "signin", phone: "012 300 002", pin: "5678" });
ok("new PIN works", r.status === 200);
r = await post("/api/auth", { action: "signin", phone: "012 300 002", pin: "1234" });
ok("old PIN no longer works", r.status === 401);

console.log("\n--- lockout ---");
for (let i = 0; i < 8; i++) await post("/api/auth", { action: "signin", phone: "097 3000 003", pin: "0000" });
r = await post("/api/auth", { action: "signin", phone: "097 3000 003", pin: "1234" });
ok("locked out after 8 wrong PINs, even with the right one", r.status === 429);

console.log("\n--- unauthenticated /api/me ---");
r = await get("/api/me");
ok("no token -> 401", r.status === 401);
r = await get("/api/me", "forged.token");
ok("forged token -> 401", r.status === 401);

console.log(fails ? "\n" + fails + " FAILED" : "\nall passed");
process.exit(fails ? 1 : 0);
