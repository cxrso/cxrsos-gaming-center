# CXRSO Gaming Center — Public Launch Plan

**Target public launch:** November 30, 2026 at 12:00 AM Eastern Time.

## How the launch gate works

- Before launch, Cloudflare Pages serves a branded coming-soon page for every path, including direct links to static files.
- A developer can enter the preview key on the coming-soon page. A successful login sets an HttpOnly, Secure, SameSite=Strict cookie that lasts 30 days.
- The preview cookie allows access to the real site during development.
- At the launch timestamp, the middleware automatically stops gating requests and the full site becomes public.
- The gate is enforced by a Pages Function, not only by browser-side JavaScript.

## Required Cloudflare Pages setup

1. Open the Cloudflare dashboard and select the Pages project connected to this repository.
2. Go to **Settings → Variables and Secrets** (or **Settings → Environment variables**, depending on the dashboard UI).
3. Under the **Production** environment, add a secret named `LAUNCH_PREVIEW_TOKEN`.
4. Set its value to a unique, high-entropy key (at least 32 random characters). Do not commit it to GitHub or share it in public.
5. Save and trigger a new production deployment if Cloudflare does not redeploy automatically.
6. In **Settings → Runtime**, set Functions failure behavior to **Fail closed** so static files are not served without the gate if the Functions quota is exhausted.

## Developer access

Visit the production site, enter the secret in the **Developer preview access** field, and submit. The browser stores a secure preview cookie for 30 days. To sign out of preview mode, visit `/__preview-logout`.

If the secret is not configured, the public coming-soon page still works, but developer preview login will return a configuration message.

## Important notes

- The launch gate applies to the deployed Cloudflare Pages site and all its paths.
- The GitHub repository is currently public. This gate does not hide source code or files on GitHub. Change repository visibility separately if the source itself must be private.
- The middleware runs on all routes so direct static-file URLs cannot bypass the prelaunch screen. This uses Pages Functions requests during the development period.
- The launch timestamp is fixed in `functions/_middleware.js` as `2026-11-30T05:00:00.000Z`, which is midnight Eastern Standard Time.
