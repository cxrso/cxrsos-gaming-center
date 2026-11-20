const LAUNCH_AT = Date.parse("2026-11-30T05:00:00.000Z"); // 12:00 AM Eastern Time
const COOKIE = "__Host-cxrso-preview";

function sameSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function page(message = "") {
  const error = message ? '<p class="error">' + message + "</p>" : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#10070b">
<meta name="robots" content="noindex,nofollow">
<title>CXRSO Gaming Center — Coming Soon</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% 0,#54162d 0,transparent 58%),#10070b;color:#fff;font:16px system-ui,sans-serif}
main{width:min(100%,560px);padding:clamp(25px,6vw,42px);border:1px solid #54263a;border-radius:24px;background:#1b0c12;text-align:center;box-shadow:0 24px 90px #0009}
.logo{width:58px;height:58px;margin:0 auto 18px;display:grid;place-items:center;border-radius:17px;background:#76223d;font-size:30px}
.eyebrow{color:#e5a6ba;font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
h1{margin:10px 0;font-size:clamp(30px,7vw,46px);line-height:1.05}
p{color:#c9b2bc;line-height:1.6}.date{margin:24px 0 8px;color:#fff;font-size:20px;font-weight:750}
#countdown{display:flex;justify-content:center;gap:10px;margin:20px 0 26px}
.unit{min-width:66px;padding:12px 8px;border:1px solid #512638;border-radius:13px;background:#260f19}
.unit strong{display:block;font-size:25px;font-variant-numeric:tabular-nums}.unit span{color:#c9aeba;font-size:10px;letter-spacing:.12em;text-transform:uppercase}
form{margin-top:28px;padding-top:22px;border-top:1px solid #43202e;text-align:left}
label{display:block;margin-bottom:8px;color:#d6bbc6;font-size:13px}
input{width:100%;padding:13px 14px;border:1px solid #603047;border-radius:11px;background:#10070b;color:#fff;font:inherit}
button{width:100%;margin-top:10px;padding:13px;border:0;border-radius:11px;background:#b83258;color:white;font:700 15px system-ui;cursor:pointer}
.error{margin:10px 0 0;color:#ff9aaf;font-size:13px}
small{display:block;margin-top:18px;color:#987b88}
</style>
</head>
<body>
<main>
<div class="logo">🎮</div>
<div class="eyebrow">CXRSO Gaming Center</div>
<h1>Something big is loading.</h1>
<p>We're putting the finishing touches on the games, browser, and the experience. The doors open to everyone on launch day.</p>
<div class="date">November 30, 2026 · 12:00 AM Eastern</div>
<div id="countdown" aria-label="Countdown">
<div class="unit"><strong id="days">--</strong><span>Days</span></div>
<div class="unit"><strong id="hours">--</strong><span>Hours</span></div>
<div class="unit"><strong id="minutes">--</strong><span>Minutes</span></div>
<div class="unit"><strong id="seconds">--</strong><span>Seconds</span></div>
</div>
<p>Until then, we're in development mode.</p>
<form method="post" action="/__preview-login">
<label for="preview-token">Developer preview access</label>
<input id="preview-token" name="token" type="password" autocomplete="current-password" placeholder="Enter preview access key" required>
<button type="submit">Open development preview</button>
${error}
</form>
<small>Public launch · November 30, 2026</small>
</main>
<script>
const target = new Date("2026-11-30T05:00:00.000Z").getTime();
function tick(){
  let left=Math.max(0,target-Date.now());
  const values={days:Math.floor(left/86400000),hours:Math.floor(left/3600000)%24,minutes:Math.floor(left/60000)%60,seconds:Math.floor(left/1000)%60};
  for(const [id,value] of Object.entries(values)) document.getElementById(id).textContent=String(value).padStart(2,"0");
  if(left===0) location.reload();
}
tick();setInterval(tick,1000);
</script>
</body>
</html>`;
}

function html(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...extraHeaders
    }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Once launch day begins in Eastern Time, all public routes open automatically.
  if (Date.now() >= LAUNCH_AT) return context.next();

  const secret = env.LAUNCH_PREVIEW_TOKEN;
  const cookie = request.headers.get("Cookie") || "";
  const previewCookie = cookie.split(";").map(v => v.trim()).find(v => v.startsWith(COOKIE + "="));
  let cookieValue = "";
  try { cookieValue = previewCookie ? decodeURIComponent(previewCookie.slice(COOKIE.length + 1)) : ""; } catch {}

  if (url.pathname === "/__preview-logout") {
    return html(page(), 200, {
      "Set-Cookie": COOKIE + "=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict"
    });
  }

  if (url.pathname === "/__preview-login" && request.method === "POST") {
    if (!secret) return html(page("Preview access has not been configured yet. Set the LAUNCH_PREVIEW_TOKEN secret in Cloudflare Pages settings."), 503);
    let submitted = "";
    try {
      const form = await request.formData();
      submitted = String(form.get("token") || "");
    } catch {}
    if (sameSecret(submitted, secret)) {
      return new Response(null, {
        status: 303,
        headers: {
          "Location": "/",
          "Cache-Control": "no-store",
          "Set-Cookie": COOKIE + "=" + encodeURIComponent(secret) + "; Path=/; Secure; HttpOnly; SameSite=Strict"
        }
      });
    }
    return html(page("That preview key didn't match. Try again."), 401);
  }

  if (secret && sameSecret(cookieValue, secret)) return context.next();

  return html(page());
}
