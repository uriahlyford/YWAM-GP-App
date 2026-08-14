import { hash, Algorithm } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
const h = await hash(randomBytes(32).toString("hex"), {
  algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1,
});
console.log(h);
