import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const PORT = Number(process.env.PORT || 10000);
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const SESSION_SECONDS = 24 * 60 * 60;
const publicPath = fileURLToPath(new URL("../public/", import.meta.url));

logging.set_level(logging.NONE);
Object.assign(wisp.options, {
  allow_udp_streams: false,
  allow_private_ips: false,
  allow_loopback_ips: false,
  dns_servers: ["1.1.1.3", "1.0.0.3"],
  hostname_blacklist: [
    /(^|\\.)localhost$/i,
    /(^|\\.)local$/i,
    /^127\\./,
    /^10\\./,
    /^192\\.168\\./,
    /^169\\\.254\\./,
    /^172\\.(1[6-9]|2[0-9]|3[01])\\./,
    /metadata\\.google\\.internal$/i,
  ],
});

function sign(value) {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}
function makeSession() {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = String(expires);
  return payload + "." + sign(payload);
}
function validSession(cookieHeader = "") {
  if (!SESSION_SECRET) return false;
  const entry = cookieHeader.split(";").map(v => v.trim()).find(v => v.startsWith("cxrso_session="));
  if (!entry) return false;
  const token = decodeURIComponent(entry.slice("cxrso_session=".length));
  const [expires, signature] = token.split(".");
  if (!expires || !signature || !/^\\d+$/.test(expires)) return false;
  if (Number(expires) < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(sign(expires), "hex");
  let actual;
  try { actual = Buffer.from(signature, "hex"); } catch { return false; }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const loginAttempts = new Map();
const fastify = Fastify({
  logger: true,
  bodyLimit: 16 * 1024,
  serverFactory: handler => createServer()
    .on("request", (req, res) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      handler(req, res);
    })
    .on("upgrade", (req, socket, head) => {
      if (req.url?.split("?")[0] === "/wisp/" && validSession(req.headers.cookie)) {
        wisp.routeRequest(req, socket, head);
      } else {
        socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
        socket.destroy();
      }
    }),
});

fastify.get("/health", async () => ({ ok: true, service: "cxrso-scramjet", authenticated: true }));

fastify.post("/login", async (request, reply) => {
  if (!ACCESS_PASSWORD || !SESSION_SECRET) {
    return reply.code(503).send({ error: "The service owner must configure ACCESS_PASSWORD and SESSION_SECRET." });
  }
  const ip = request.ip;
  const now = Date.now();
  const prior = loginAttempts.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (now > prior.resetAt) { prior.count = 0; prior.resetAt = now + 15 * 60 * 1000; }
  if (prior.count >= 10) return reply.code(429).send({ error: "Too many attempts. Try again in 15 minutes." });
  prior.count += 1;
  loginAttempts.set(ip, prior);

  const supplied = String(request.body?.password || "");
  const a = Buffer.from(supplied);
  const b = Buffer.from(ACCESS_PASSWORD);
  const match = a.length === b.length && timingSafeEqual(a, b);
  if (!match) return reply.code(401).send({ error: "Incorrect access code." });

  loginAttempts.delete(ip);
  reply.header("Set-Cookie", `cxrso_session=${encodeURIComponent(makeSession())}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`);
  return { ok: true };
});

fastify.addHook("onRequest", async (request, reply) => {
  if (request.url === "/health" || request.url === "/login") return;
  if (!validSession(request.headers.cookie)) {
    return reply.code(401).type("application/json").send({ error: "Sign in to CXRSO Browser first." });
  }
});

fastify.register(fastifyStatic, { root: publicPath, decorateReply: true });
fastify.register(fastifyStatic, { root: scramjetPath, prefix: "/scram/", decorateReply: false });
fastify.register(fastifyStatic, { root: libcurlPath, prefix: "/libcurl/", decorateReply: false });
fastify.register(fastifyStatic, { root: baremuxPath, prefix: "/baremux/", decorateReply: false });

fastify.setNotFoundHandler((request, reply) => {
  return reply.code(404).type("text/html").sendFile("404.html");
});

fastify.listen({ port: PORT, host: "0.0.0.0" }).catch(error => {
  fastify.log.error(error);
  process.exit(1);
});
