/**
 * CXRSO Browser fetch gateway.
 * Read-only HTTP(S) page proxy. Not an anonymity service.
 *
 * Deploy behind Cloudflare Access or another authentication layer.
 * Do not expose this as an unrestricted public proxy.
 */
const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal"]);
function isPrivateHost(host) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.has(h) || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80:")) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a=+m[1], b=+m[2];
    if ([a,b,+m[3],+m[4]].some(n=>n>255)) return true;
    return a===0 || a===10 || a===127 || a===169&&b===254 || a===172&&b>=16&&b<=31 || a===192&&b===168 || a>=224;
  }
  return false;
}
function safeTarget(raw, base) {
  let u;
  try { u = new URL(raw, base); } catch { throw new Error("Invalid destination URL"); }
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only HTTP and HTTPS pages are supported");
  if (isPrivateHost(u.hostname)) throw new Error("Private and local network addresses are blocked");
  u.username = ""; u.password = "";
  return u;
}
function proxyUrl(u, base) {
  const target = safeTarget(u, base);
  return "/?url=" + encodeURIComponent(target.href);
}
class AttrRewriter {
  constructor(attribute, base) { this.attribute=attribute; this.base=base; }
  element(el) {
    const value=el.getAttribute(this.attribute);
    if (!value || value.startsWith("#") || /^(data:|javascript:|mailto:|tel:|blob:)/i.test(value)) return;
    try { el.setAttribute(this.attribute, proxyUrl(value, this.base)); } catch {}
  }
}
function rewriteCss(css, base) {
  return css.replace(/url\(\s*(['"]?)(?!data:|https?:\/\/[^)]*\bdata:)([^)'"]+)\1\s*\)/gi,(all,q,value)=>{
    try { return "url(" + JSON.stringify(proxyUrl(value.trim(),base)) + ")"; } catch { return all; }
  }).replace(/@import\s+(['"])([^'"]+)\1/gi,(all,q,value)=>{
    try { return "@import " + q + proxyUrl(value,base) + q; } catch { return all; }
  });
}
export default {
 async fetch(request) {
  const incoming = new URL(request.url);
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Read-only browsing proxy", {status:405});
  const raw = incoming.searchParams.get("url");
  if (!raw) return new Response("CXRSO Browser gateway is ready. Supply ?url=https://example.com", {headers:{"content-type":"text/plain; charset=utf-8"}});
  let target;
  try { target = safeTarget(raw); } catch(e) { return new Response(e.message,{status:400}); }
  let upstream;
  try {
    upstream = await fetch(target.href, {
      method: request.method,
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CXRSOBrowser/2.0)",
        "Accept": request.headers.get("Accept") || "*/*",
        "Accept-Language": request.headers.get("Accept-Language") || "en-US,en;q=0.9"
      }
    });
  } catch { return new Response("The destination could not be reached.",{status:502}); }
  if ([301,302,303,307,308].includes(upstream.status)) {
    const location=upstream.headers.get("Location");
    if (!location) return new Response("Redirect blocked.",{status:502});
    try { const next=safeTarget(location,target); return Response.redirect(incoming.origin + "/?url=" + encodeURIComponent(next.href),302); }
    catch(e) { return new Response("Redirect blocked: "+e.message,{status:400}); }
  }
  const headers=new Headers(upstream.headers);
  for (const h of ["content-security-policy","content-security-policy-report-only","x-frame-options","frame-options","cross-origin-opener-policy","cross-origin-embedder-policy","cross-origin-resource-policy","set-cookie","strict-transport-security"]) headers.delete(h);
  headers.set("access-control-allow-origin","*");
  headers.set("cache-control","no-store");
  headers.delete("content-length");
  const type=headers.get("content-type") || "";
  if (type.includes("text/html")) {
    headers.set("content-type","text/html; charset=utf-8");
    let response=new Response(upstream.body,{status:upstream.status,headers});
    return new HTMLRewriter()
      .on("a",new AttrRewriter("href",target.href))
      .on("form",new AttrRewriter("action",target.href))
      .on("img",new AttrRewriter("src",target.href))
      .on("script",new AttrRewriter("src",target.href))
      .on("iframe",new AttrRewriter("src",target.href))
      .on("source",new AttrRewriter("src",target.href))
      .on("video",new AttrRewriter("src",target.href))
      .on("audio",new AttrRewriter("src",target.href))
      .on("link",new AttrRewriter("href",target.href))
      .transform(response);
  }
  if (type.includes("text/css")) {
    const css=await upstream.text();
    return new Response(rewriteCss(css,target.href),{status:upstream.status,headers});
  }
  return new Response(upstream.body,{status:upstream.status,headers});
 }
};
