# Auth0 tenant configuration

The development tenant `hrf-alt-dev.us.auth0.com` is hardcoded in several
places. One of them was a security boundary and has been fixed; the rest are
native build configuration and need a decision plus the production tenant name,
which is why they are documented here rather than changed.

## Fixed

`app/utils/secure-deep-links.ts` held the tenant in `VERIFIED_DOMAINS`, the
allowlist of domains permitted to deep link into the app. A domain on that list
can hand the app a URL it will act on, so a production build was either
rejecting its own legitimate auth callbacks, or trusting callbacks from the
development tenant — a tenant with weaker controls and more people able to
configure it.

It now derives from `AUTH0_CONFIG.domain`, which reads
`EXPO_PUBLIC_AUTH0_DOMAIN`. The allowlist can no longer drift from the tenant
the app actually authenticates against. Covered by
`app/utils/__tests__/secure-deep-links.test.ts`, including a case asserting the
old dev tenant is rejected under a different configuration.

## Still hardcoded — needs your input

These three generate native Android configuration at prebuild, so they cannot
read a runtime value the way the app can. Each needs the production tenant name
before it can be changed, and App Links additionally need the tenant to host a
matching `assetlinks.json`.

| File | Line | What it controls |
| --- | --- | --- |
| `app.json` | 26 | iOS ATS exception |
| `app.json` | 65 | Android App Links intent filter |
| `auth0-config-plugin.js` | 14 | `auth0Domain` manifest placeholder |
| `android-app-links-plugin.js` | 24 | App Links host match |

`app.json:22` also names a legacy Twilio subdomain in the ATS exceptions.

### What to confirm

1. **Do production builds use a different Auth0 tenant?** If yes, all four
   sites are wrong in production today, and Android App Links verification is
   pointing at a domain that will not serve the right `assetlinks.json`.
2. **If there is only one tenant**, then the dev tenant is the production
   tenant. That is a larger finding than a naming inconsistency: a tenant used
   for development, with development-grade access control, is authenticating
   real users in an app used by people at legal risk. It should be reviewed on
   its own terms.
3. Either way these values should come from the build profile — EAS build
   profiles can supply different env values per profile — rather than being
   literals in tracked files.
