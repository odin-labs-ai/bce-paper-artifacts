/**
 * FIXTURE — b3/coverage-envelope Class A #1: the OPTIONS-BAG egress form.
 *
 * `http.request` / `https.request` accept an options object whose `host` (or `hostname`) property
 * names the target host directly — NOT a URL string argument. 0.5.0 DETECTED the `https.request`
 * callee but could not resolve the `{ hostname: 'api.openai.com' }` options bag to a host (it fell
 * through to `unresolvable`), so a reader reaching a provider directly via the options-bag idiom
 * silently produced NO egress edge — an UNCAUGHT real host literal.
 *
 * `api.openai.com` is NOT in the egress-reader blueprint's `governedHosts`, so the widened resolver
 * folds the options bag to the host, emits a `type:'egress'` edge, and the constraint scores this
 * RED (a critical violation) — closing the gap. Proves Class A #1 goes RED for the RIGHT reason:
 * the host was resolved from the options bag AND is ungoverned, not silently skipped.
 */
import https from 'node:https';

export function callProviderOptbag(): unknown {
  return https.request({ hostname: 'api.openai.com', path: '/v1/chat/completions', method: 'POST' });
}
