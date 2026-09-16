---
name: testing-lever
description: How to reach, drive and adversarially test the PULLTHELEVER.BUILD slot machine (Next.js app in this repo), including Vercel preview access, the /api/spin rate limiter, and browser automation tricks that work on this box.
---

# Testing PULLTHELEVER.BUILD (lever)

## Reaching a running build
- Local: `npm run dev` on :3000 (needs `OPENAI_API_KEY`, usually already in `.env.local`).
  The `/api/spin` limiter is per-process, so locally one dev server = one bucket; on Vercel it is
  per serverless instance and therefore best-effort (see below).
- Vercel previews of this project have SSO deployment protection (`ssoProtection.deploymentType =
  all_except_custom_domains`) and return 302 → `vercel.com/sso-api`. To test a preview without a
  human login, mint an automation bypass with `VERCEL_TOKEN`:
  `curl -X PATCH https://api.vercel.com/v1/projects/<projectId>/protection-bypass -H "Authorization: Bearer $VERCEL_TOKEN" -d '{"generate":{}}'`
  then in the browser navigate once to
  `<preview>/?x-vercel-protection-bypass=<secret>&x-vercel-set-bypass-cookie=true` (sets `_vercel_jwt`
  cookie for 7 days) and for shell/curl send header `x-vercel-protection-bypass: <secret>`.
  Revoke when done: same endpoint with `{"revoke":{"secret":"<secret>","regenerate":false}}`.

## Driving the machine
- UI: header mute button, primary "Generate a product" / "Pull again", and a Spin again / Copy / Share
  row that only appears in the landed state. Spacebar also pulls (`components/Machine.tsx`).
- The app **prefetches** a spin on mount and again after every landing. Consequences:
  - a pull right after page load shows the glyph warm-up only if you click before the prefetch resolves;
  - a shared `?p=&a=` link renders instantly from the URL params but still fires one background
    POST /api/spin (the mount prefetch) — do not assert "zero network calls";
  - to force an error state you usually need **two** pulls: the first consumes the held prefetch, the
    failing prefetch then leaves the buffer empty so the second pull surfaces the error.
- Each pull costs ~2 OpenAI calls (spin + next prefetch). Keep total calls modest.

## Exercising the abuse hardening cheaply
- `/api/spin` checks in order: Origin host mismatch → 403; per-IP sliding window 12/60s → 429 +
  `Retry-After`; `Content-Length > 16384` → 413; then OpenAI. So **oversized-body requests still
  increment the rate-limit counter but cost no OpenAI tokens** — 12× 20 KB POSTs then one more
  request is a cheap, deterministic way to prove 429/Retry-After.
- The limiter is per instance: curl from the box and the browser often land on *different* Vercel
  instances, so exhausting via curl may not make the page show the error. To see the UI rate-limit
  error ("The machine is catching its breath. Try again shortly."), run the 12 oversized POSTs from
  the page itself (browser console `fetch("/api/spin", …)`) so they share the page's connection, then
  click Pull again.

## Browser automation notes (this box)
- No window manager: `wmctrl`/`xdotool` fail ("Cannot get client list", "Failed creating new xdo
  instance"); the Chrome viewport is fixed (~1024x768 screenshot).
- Chrome runs with `--remote-debugging-port=29229`, so raw CDP is available and is the only way to
  emulate media features/network: `Emulation.setEmulatedMedia` with
  `prefers-reduced-motion: reduce` works, but the browser tool resets emulation on its next
  click/type — trigger the pull from the same CDP session (`Input.dispatchKeyEvent` Space) instead.
- `Network.emulateNetworkConditions {offline:true}` did **not** block fetches (navigator.onLine stayed
  true). What works for a genuine network failure is `Network.setBlockedURLs` with pattern
  `*api/spin*` (note: `*/api/spin*` does **not** match) kept open in the same CDP session.
- `navigator.clipboard.readText()` hangs (page not focused). To verify Copy/Share, open a scratch page
  on the same origin, inject a `<textarea>`, click it and press Control+v; grant clipboard access with
  CDP `Browser.grantPermissions` (`clipboardReadWrite`).
- Clipboard-content checks: keep the app in tab 0 and open a same-origin scratch page (any 404 URL
  works, e.g. `/robots.txt`) in tab 1, inject `<textarea id=paste>`, click it, then `press_key
  Control+v` **with `tab_idx` set to that tab** (otherwise the keypress goes to the foreground tab).
  Read the value back via CDP `Runtime.evaluate` (the browser tool's console returns `undefined` for
  long strings) and `cmp` it against the expected text generated with
  `npx tsx -e 'import {buildDevinPrompt} from "./lib/devinPrompt"; …'`.
- Vercel preview URLs are per-deployment (`lever-<hash>-…`); a new commit gets a new host, and the
  `_vercel_jwt` bypass cookie is per host, so re-run the bypass URL for each new deployment. List
  deployments with `GET /v6/deployments?projectId=prj_bSP2ZrJ0qsvyBYBEqSEcDmxFooAp`.
- Responsive checks: the viewport is fixed, so use CDP `Emulation.setDeviceMetricsOverride` (+
  `Page.captureScreenshot`) and `Emulation.clearDeviceMetricsOverride` afterwards.
- To time animations, install a `MutationObserver` on the `section` element that pushes
  `performance.now()` and compare spans (normal reveal ≈ 11.6 s, reduced motion ≈ 3.1 s).

- **The browser tool strips `target="_blank"` from any tab it has viewed/instrumented** (the
  attribute reads `null` client-side even though the SSR HTML has it), so clicking such a link
  navigates in-tab. To prove real new-tab behaviour: `Target.createTarget` a fresh tab via CDP,
  never `view` it with the browser tool, click via `Input.dispatchMouseEvent`, then check
  `Target.getTargets` for the new page. Devin links redirect to
  `app.devin.ai/auth/login?redirect=%2F%3Fprompt%3D…` — decode `redirect` then `prompt`.

## Devin Secrets Needed
- `OPENAI_API_KEY` (server-side generation), `VERCEL_TOKEN` (preview protection bypass).
