# CXRSO Browser V2 gateway

This repository contains the Cloudflare Worker source for a **read-only page-fetch gateway**. It is a compatibility layer, not a full browser engine, VPN, or anonymity service.

## Deploy

1. In Cloudflare, create a Worker named `cxrso-browser-gateway`.
2. Deploy `worker.js` (or connect this repository and use `wrangler.toml`).
3. Put the Worker behind Cloudflare Access. Do not leave an unrestricted public proxy exposed.
4. Copy the deployed Worker URL and set it as the gateway endpoint in `browser.html` (the `GATEWAY_URL` constant).
5. Test a simple page first, then sites that use scripts, sign-in, streaming, or downloads.

## Current limitations

- Some sites require browser APIs, complex redirects, cookies, authentication, DRM, WebSockets, or anti-bot checks that a fetch proxy cannot reproduce.
- This Worker intentionally supports GET/HEAD only and does not forward visitors' cookies or credentials to destination sites.
- The gateway can fetch public HTTP(S) pages and rewrites common HTML/CSS asset links. It is not guaranteed to render every site.
- Cloudflare Access must be configured before public use. Do not treat the gateway as anonymous browsing.
- Never remove the private/local network destination checks or expose this as an unrestricted open proxy.
