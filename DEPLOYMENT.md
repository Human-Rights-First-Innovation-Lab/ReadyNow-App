# ReadyNow Deployment Guide

Complete guide for building and deploying ReadyNow to the Apple App Store and Google Play Store.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Version Management](#version-management)
3. [Building with EAS](#building-with-eas)
4. [iOS Deployment](#ios-deployment)
5. [Android Deployment](#android-deployment)
6. [Environment Configuration](#environment-configuration)
7. [Twilio Functions Deployment](#twilio-functions-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts

- **Expo Account**: Sign up at [expo.dev](https://expo.dev)
- **Apple Developer Account**: $99/year at [developer.apple.com](https://developer.apple.com)
- **Google Play Developer Account**: $25 one-time fee at [play.google.com/console](https://play.google.com/console)

### Required Tools

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to your Expo account
eas login

# Verify you're logged in
eas whoami
```

### Initial EAS Setup

If this is your first time using EAS with this project:

```bash
# Configure EAS for your project
eas build:configure

# This creates/updates eas.json with build profiles
```

---

## Version Management

### How to Change Version

Version numbers follow semantic versioning: `MAJOR.MINOR.PATCH` (e.g., `1.2.3`)

> **This project uses remote versioning.** `eas.json` sets
> `"appVersionSource": "remote"`, so the iOS build number and the Android
> version code are held by EAS, not by `app.json`. That is why `app.json` has
> no `ios.buildNumber` and no `android.versionCode` - adding them would have
> no effect on a build.

#### The user-facing version (`app.json`)

This is the only version value you edit by hand:

```json
{
  "expo": {
    "version": "1.2.7"
  }
}
```

Bump it when the release is user-facing. Leave it alone for a TestFlight
build that only needs a new build number.

#### The build number (EAS)

The `production` profile sets `autoIncrement: true`, so every production
build takes the next number automatically. Nothing to edit.

```bash
# Read the current remote values
eas build:version:get --platform ios

# Set them by hand, if a store upload ever gets out of step
eas build:version:set --platform ios
```

### Version Number Rules

| Change Type | Version Update | Example |
|-------------|---------------|---------|
| Major features, breaking changes | MAJOR | 1.0.0 → 2.0.0 |
| New features, no breaking changes | MINOR | 1.0.0 → 1.1.0 |
| Bug fixes, minor updates | PATCH | 1.0.0 → 1.0.1 |

**Important**:
- iOS `buildNumber` and Android `versionCode` must **always increase**
- App Store/Play Store will reject builds with the same or lower build numbers
- Both are incremented for you by `autoIncrement` on the `production` profile

---

## Building with EAS

### Build Profiles

Your `eas.json` defines different build profiles:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "distribution": "store"
    }
  }
}
```

### Build Commands

#### Development Build (Internal Testing)

```bash
# iOS development build
eas build --profile development --platform ios

# Android development build
eas build --profile development --platform android

# Both platforms
eas build --profile development --platform all
```

**Use for**: Testing on physical devices, debugging, internal QA

#### Preview Build (ad-hoc iOS / Android internal testing)

> **Not for TestFlight.** `preview` uses `distribution: internal`, which
> produces an ad-hoc-signed IPA that App Store Connect rejects. Use the
> `testflight` profile instead - it draws from the same `preview` environment,
> so it hits the same staging backends, but is App Store-signed.

```bash
# iOS ad-hoc build, installable on registered devices only
eas build --profile preview --platform ios

# Android preview (Internal Testing)
eas build --profile preview --platform android
```

**Use for**: Android internal testing, stakeholder demos on registered iOS devices

#### TestFlight Build (iOS beta against staging)

```bash
eas build --profile testflight --platform ios
```

**Use for**: TestFlight betas, including NILRA referral testing against the
staging database.

#### Production Build (App Store/Play Store)

```bash
# iOS production build
eas build --profile production --platform ios

# Android production build
eas build --profile production --platform android

# Both platforms
eas build --profile production --platform all
```

**Use for**: Public releases to App Store and Play Store

### Build Options

```bash
# Auto-increment version
eas build --platform ios --auto-increment

# Clear cache before building
eas build --platform ios --clear-cache

# Build locally (requires Xcode/Android Studio)
eas build --platform ios --local

# Non-interactive mode (CI/CD)
eas build --platform ios --non-interactive

# Specify a message for the build
eas build --platform ios --message "Fix notification bug"
```

### Monitoring Builds

```bash
# View build status
eas build:list

# View specific build details
eas build:view [BUILD_ID]

# Cancel a running build
eas build:cancel
```

---

## iOS Deployment

### Step 1: Build for iOS

```bash
# TestFlight beta, pointed at the STAGING backends (NILRA test database)
eas build --profile testflight --platform ios

# App Store release, pointed at the PRODUCTION backends
eas build --profile production --platform ios
```

This will:
1. Prompt for Apple credentials (if not configured)
2. Generate/update iOS certificates and provisioning profiles
3. Build the app in the cloud
4. Provide a download link for the `.ipa` file

### Step 2: Download the IPA

After the build completes:

```bash
# Download the latest build
eas build:download --platform ios --latest

# Or download a specific build
eas build:download --id [BUILD_ID]
```

The `.ipa` file will be downloaded to your current directory.

### Step 3: Upload to App Store Connect

#### Option A: Using Transporter (Recommended)

1. **Install Transporter**
   - Download from the Mac App Store
   - Or use the built-in version in Xcode

2. **Open Transporter**
   - Launch the Transporter app
   - Sign in with your Apple ID (Apple Developer account)

3. **Upload IPA**
   - Click the "+" button or drag and drop your `.ipa` file
   - Click "Deliver" to upload to App Store Connect
   - Wait for upload to complete (shows progress bar)
   - You'll see "Delivered" when complete

4. **Verify Upload**
   - Go to [App Store Connect](https://appstoreconnect.apple.com)
   - Navigate to your app → TestFlight or App Store
   - The build should appear within 5-10 minutes after processing

#### Option B: Using EAS Submit

```bash
# Submit directly to App Store Connect
eas submit --platform ios --latest

# Or submit a specific build
eas submit --platform ios --id [BUILD_ID]
```

This requires your Apple ID credentials and app-specific password.

#### Option C: Using Xcode

1. Open Xcode
2. Go to **Window** → **Organizer**
3. Drag the `.ipa` file into the Organizer
4. Click "Distribute App"
5. Follow the wizard to upload to App Store Connect

### Step 4: Configure in App Store Connect

1. **Go to App Store Connect**
   - Visit [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
   - Select your app

2. **For TestFlight (Internal Testing)**
   - Go to **TestFlight** tab
   - Select the build you just uploaded
   - Add internal testers
   - Click "Start Testing"
   - Testers will receive an email invitation

3. **For TestFlight (External Testing)**
   - Go to **TestFlight** → **External Testing**
   - Create a new group or select existing
   - Add the build
   - Submit for Beta App Review (required for external testers)
   - Add testers via email or public link

4. **For App Store (Production)**
   - Go to **App Store** tab
   - Click "+" to create a new version
   - Fill in all required metadata:
     - App Name
     - Subtitle
     - Description
     - Keywords
     - Screenshots (required for all device sizes)
     - App Icon
     - Privacy Policy URL
     - Support URL
   - Select the build you uploaded
   - Submit for App Review

### App Store Review Process

**Timeline**: Usually 24-48 hours, can be up to 7 days

**Common Rejection Reasons:**
- Missing privacy policy
- Incomplete metadata
- Screenshots don't match app functionality
- App crashes or bugs
- Violates App Store guidelines

**Tips for Approval:**
- Provide clear, accurate screenshots
- Write detailed review notes
- Include test account credentials if needed
- Respond quickly to reviewer questions

---

## Android Deployment

### Step 1: Build for Android

```bash
# Production build for Play Store
eas build --profile production --platform android

# Or preview build for Internal Testing
eas build --profile preview --platform android
```

This will:
1. Prompt for Google Play credentials (if not configured)
2. Generate/update Android signing keys
3. Build the `.aab` (Android App Bundle) file
4. Provide a download link

### Step 2: Download the AAB

```bash
# Download the latest build
eas build:download --platform android --latest

# Or download a specific build
eas build:download --id [BUILD_ID]
```

The `.aab` file will be downloaded to your current directory.

### Step 3: Upload to Google Play Console

#### Option A: Using Google Play Console (Recommended)

1. **Go to Play Console**
   - Visit [play.google.com/console](https://play.google.com/console)
   - Select your app (or create a new one)

2. **For Internal Testing**
   - Go to **Testing** → **Internal testing**
   - Click "Create new release"
   - Upload the `.aab` file
   - Add release notes
   - Review and roll out to internal testers
   - Add testers via email list

3. **For Closed Testing (Beta)**
   - Go to **Testing** → **Closed testing**
   - Create a new track or use existing
   - Click "Create new release"
   - Upload the `.aab` file
   - Add release notes
   - Review and roll out
   - Share the opt-in URL with beta testers

4. **For Production**
   - Go to **Production** → **Releases**
   - Click "Create new release"
   - Upload the `.aab` file
   - Add release notes (in all supported languages)
   - Review and roll out to production
   - Choose rollout percentage (e.g., 20%, 50%, 100%)

#### Option B: Using EAS Submit

```bash
# Submit directly to Play Store
eas submit --platform android --latest

# Or submit a specific build
eas submit --platform android --id [BUILD_ID]
```

Requires Google Play service account key (JSON file).

### Step 4: Configure Play Store Listing

Before first production release, complete the store listing:

1. **Main Store Listing**
   - App name
   - Short description (80 characters)
   - Full description (4000 characters)
   - App icon (512x512px)
   - Feature graphic (1024x500px)
   - Screenshots (at least 2, up to 8)
   - App category
   - Content rating

2. **Privacy Policy**
   - Add privacy policy URL
   - Complete Data Safety form
   - Declare data collection practices

3. **App Content**
   - Target audience
   - Content rating questionnaire
   - News app declaration (if applicable)

4. **Pricing & Distribution**
   - Free or paid
   - Available countries
   - Content rating

### Google Play Review Process

**Timeline**: Usually 1-3 days for first release, faster for updates

**Common Rejection Reasons:**
- Missing privacy policy
- Incomplete Data Safety form
- Screenshots don't match app
- Violates Play Store policies
- App crashes or bugs

---

## Environment Configuration

### EAS Environments

Each build profile in `eas.json` declares which EAS environment it draws
variables from:

| Profile | Distribution | Environment | Backends |
| --- | --- | --- | --- |
| `development` | internal | `development` | staging |
| `preview` | internal (ad-hoc) | `preview` | staging |
| `testflight` | **store** | `preview` | **staging** |
| `production` | **store** | `production` | **live** |

Distribution and environment are independent. `distribution` decides how the
build is signed - only `store` can be uploaded to App Store Connect, which is
why `preview` cannot reach TestFlight. `environment` decides which backends the
build talks to. `testflight` combines store signing with staging backends, so a
beta tester's NILRA referral lands in `hrf-test.nilra.org`, not the live hub.

> **Do not promote a `testflight` build to the App Store.** Both profiles carry
> the same bundle identifier, so both land in the same App Store Connect app
> record and appear side by side in the build list. A `testflight` build points
> at staging: released to the public it would send real users' referrals to
> NILRA's test database, where nobody is watching for them. Release builds come
> from `--profile production` only. Check the build's profile in App Store
> Connect before you submit it for review.

```bash
# List the variables in an environment (secrets show as *****)
eas env:list --environment production

# Create or update one
eas env:create --environment production --name EXPO_PUBLIC_ALERT_URL --value "https://<host>/alert"
```

**`EXPO_PUBLIC_*` variables are not secrets.** They are inlined into the
JavaScript bundle at build time and are extractable from any shipped build.
Anything that must stay private belongs in a Twilio Function's environment,
not here. Variables marked *secret* in EAS are readable only by the builder.

### Required before any iOS build

A build will succeed with these missing and fail at runtime, so check them
first. Every one is read by `app/` at startup or on the alert path:

```
EXPO_PUBLIC_ALERT_URL                      <- /alert Function; the alert button
EXPO_PUBLIC_AUTH0_DOMAIN                   <- sign-in
EXPO_PUBLIC_AUTH0_CLIENT_ID
EXPO_PUBLIC_AUTH0_AUDIENCE
EXPO_PUBLIC_AUTH0_CONNECTION
EXPO_PUBLIC_AUTH0_REDIRECT_URI
EXPO_PUBLIC_ENCRYPTION_KEY_NAME
EXPO_PUBLIC_MONGODB_API_ENDPOINT
EXPO_PUBLIC_SENTRY_DSN
EXPO_PUBLIC_TWILIO_API_SECRET
EXPO_PUBLIC_TWILIO_COUNTRIES_URL
EXPO_PUBLIC_TWILIO_NILRA_HANDLER_URL
EXPO_PUBLIC_TWILIO_NOTIFICATION_HANDLER_URL
```

`EXPO_PUBLIC_ALERT_URL` is the one to check hardest. `app/services/alert-api.ts`
and `app/utils/device-credential.ts` both read it, and if it is unset the alert
button reports an honest failure rather than delivering - which is the one
behaviour this app exists to get right.

Verify an environment is complete before spending a build:

```bash
eas env:list --environment production
```

### Credentials for `eas submit`

`eas.json` carries `ascAppId` and `appleTeamId` - both are public values
(the team ID is extractable from any shipped IPA, and the ASC app ID appears
in the App Store listing URL).

**The Apple ID is deliberately not in `eas.json`.** It is a login identifier,
and this repository is intended to be public. Supply it through the
environment instead:

```bash
export EXPO_APPLE_ID="<the Apple account email>"
eas submit --profile production --platform ios --latest
```

For non-interactive submission, also set `EXPO_APPLE_APP_SPECIFIC_PASSWORD`.

---

## Twilio Functions Deployment

The seven handlers in `twilio/functions/` are deployed as a Twilio Functions &
Assets **Service**, from this repository, using the Serverless Toolkit. They are
no longer edited in the Console. `send-emergency-alerts` is deliberately not
among them - see below.

Functions (Classic) was closed to new functions on 2026-09-13 and is being
migrated away by Twilio between 2026-09-14 and 2026-10-26. The legacy Classic
deployment must stay live throughout and must not be deleted: installed builds
have their endpoint URLs inlined at build time and there is no over-the-air
update path, so `/send-emergency-alerts` in particular keeps serving app
versions that can never be reached again. Its hostname and auth status are
tracked outside this repository.

### One-time setup

The Twilio CLI is **not** in homebrew-core - `brew install twilio` alone fails
with "No available formula". It lives in Twilio's own tap.

Use npm rather than Homebrew for this project:

```bash
npm install -g twilio-cli          # requires Node 20+; CLI is 6.2.4
twilio plugins:install @twilio-labs/plugin-serverless
twilio --version
```

Twilio's docs recommend Homebrew, but that recommendation is about getting
auto-updates, and it works against us here: the tap's formula pins `node@24`,
while `@twilio-labs/plugin-serverless` (4.0.0) declares
`engines: { node: "^20.x || ^22.x" }`. Installing through npm on the repo's
Node 22 puts the CLI and the plugin on the same supported runtime.

If you prefer Homebrew anyway, the tap is required and the branch matters:

```bash
brew tap twilio/brew && brew install twilio
```

The tap's legacy `master` branch contains a placeholder formula that
deliberately aborts with a "switching the default branch" message. If you hit
that, the local tap clone is stale:

```bash
brew untap twilio/brew && brew tap twilio/brew && brew upgrade twilio
```

A signed macOS `.pkg` is also published; get the current link from
[Install the Twilio CLI](https://www.twilio.com/docs/twilio-cli/getting-started/install)
rather than constructing a download URL.

Then authenticate:

```bash
twilio profiles:create --profile readynow-prod
```

This prompts for your **Account SID and Auth Token** - that is the only thing it
asks for. It uses the auth token once to generate an API Key, stores that key,
and discards the token; the auth token is never written to disk.

For CI, skip profiles and use environment variables instead, with a key minted
in the Console for that purpose:

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_API_KEY=SKxxxxxxxx
TWILIO_API_SECRET=xxxxxxxx
```

### Which directory to run from

The two toolchains want different directories, and getting it wrong fails in a
confusing way.

| Command | Run from | Looks for |
|---|---|---|
| `twilio serverless:*` | `twilio/` | `.twilioserverlessrc` |
| `eas *` | repository root | `app.json`, `eas.json` |

`twilio/package.json` exists for the Serverless Toolkit's dependency list, and
EAS treats any directory containing one as a project root. Run `eas build` from
`twilio/` and it does not error - it scaffolds a *default* `eas.json` there and
then reports:

```
Missing build profile in eas.json: "testflight".
Available profiles: ["development", "preview", "production"]
```

The profile is not missing; you are in the wrong directory and reading a file
EAS just invented. Delete the generated `twilio/eas.json` and run again from the
root. If you ever see "Generated eas.json", that is the tell.

### Two environments, one Service

One Service holds both. The four digits in the domain are assigned once and
shared, so the environments differ only by suffix:

| Environment | Domain | Env file | Database |
|---|---|---|---|
| production | `readynow-XXXX.twil.io` | `.env.prod` | `readynow_notifications` |
| non-production | `readynow-XXXX-dev.twil.io` | `.env.nonprod` | `readynow-nonprod` |

Copy `twilio/.env.example` to both `.env.prod` and `.env.nonprod` and fill each
in. The header of that file lists what differs between them and what is shared
on purpose.

**Non-production sends real SMS, deliberately.** `MESSAGING_SERVICE_SID` is the
production Messaging Service in both files, and `EXPO_ACCESS_TOKEN` likewise for
push. A message Twilio accepted is not a message that arrived - that gap is the
entire reason `alert-status.js` exists - so delivery is verified by watching an
alert land on a handset, including from TestFlight. Test with numbers you own.
Do not split these without changing how the release is verified.

Both files are gitignored and must stay that way - they carry live database
credentials. The env file is passed explicitly on every deploy so the command
says which database it points at.

### Reconcile dependencies before the first deploy

`twilio/package.json` pins versions that match the app where the app declares
them, and conservative current versions where it does not. **Check these against
the Console's Dependencies tab before deploying**, and match what is running
today rather than upgrading. A migration is not the moment to also change the
MySQL driver. Note that `twilio` 6.x, `mongodb` 7.x and `@noble/ciphers` 2.x are
all major versions ahead of what is pinned here - do not take those bumps as
part of this work.

### Service settings that are not in code

Two things live on the Service itself and are not set by any file in this repo:

| Setting | Required value | What breaks if wrong |
|---|---|---|
| Add my Twilio Credentials (ACCOUNT_SID) and (AUTH_TOKEN) to ENV | **Enabled** | `context.getTwilioClient()` fails in `alert.js`, so no SMS is sent. `context.AUTH_TOKEN` is undefined in `alert-status.js`, so `validateRequest()` rejects every genuine status callback with a 403 - which silently disables delivery confirmation and the retry ladder. |
| Path visibility | **public**, all 7 paths | `protected` makes Twilio enforce a request signature, rejecting every request from the app. All seven handlers authenticate in-handler instead. |

### Deploying

```bash
# First deploy only, creating the Service. The name becomes part of the
# domain and CANNOT be changed afterwards. Start non-production.
cd twilio && twilio serverless:deploy --environment dev --env .env.nonprod
```

Record the `ZS...` Service SID from the output into `serviceSid` in
`twilio/.twilioserverlessrc`, then commit it. Every later deploy targets it
explicitly:

```bash
# non-production
twilio serverless:deploy --environment dev --env .env.nonprod --service-sid ZSxxxxxxxx

# production
twilio serverless:deploy --production --env .env.prod --service-sid ZSxxxxxxxx
```

Environment variables belong to the environment, not the build, so
`serverless:activate` promotes code without carrying variables across. Deploy
each environment with its own `--env` file rather than promoting between them.

**While `serviceSid` is empty, a deploy creates a new Service on a new domain.**
Likewise, `--environment <suffix>` creates the environment if no environment
with that suffix exists - along with a new domain. Read the domain line in the
deploy output before trusting it.

To run the handlers locally without touching the account:

```bash
cd twilio && twilio serverless:start
```

### Two live alert stacks

Until pre-migration installs drain, `/alert` and `/alert-status` run in two
places at once - the Classic deployment and this Service - against one database.
Keep `MESSAGING_SERVICE_SID` and every `DO_MYSQL_*` value identical between
them, and make sure each stack's `ALERT_STATUS_CALLBACK_URL` points at *its own*
`/alert-status`. Drift between the two presents as alerts that report success
and deliver nothing.

The `ALERT_ENDPOINT` GitHub secret driving `alert-sweep.yml` should point at
this Service only. The sweep is database-driven, so one sweeper covers rows
written by either stack.

### Post-deploy verification

Run in this order; each step assumes the ones above it passed.

- [ ] Service credentials setting is enabled, and runtime is `node22`
- [ ] All eight paths report `public`
- [ ] Every variable in `.env.example` is present on the Service, and
      `DO_MYSQL_CA_CERT` is not truncated (450 bytes per variable, ~3 kB total)
- [ ] No test file is reachable as a route
- [ ] `./test-nilra-api.sh` and `./test-nilra-api-with-dob.sh` pass
- [ ] `/countries` returns data, and 401s with no `X-ReadyNow-Key`
- [ ] `/save` writes to MongoDB
- [ ] `/notification-manager` `register` works; `dispatch` is refused without
      `TWILIO_DISPATCH_SECRET`
- [ ] `alert-sweep.yml` run succeeds and writes an `ops_heartbeat` row; a wrong
      bearer token 401s
- [ ] Full alert path end to end: register, stage, fire, real SMS received
- [ ] The status callback records delivery - this is what proves `AUTH_TOKEN`
      reached the handler. A 200 from `/alert` only means Twilio accepted the
      request.
- [ ] An unsigned POST to `/alert-status` returns 403
- [ ] On the Classic deployment, `/send-emergency-alerts` and `/alert` still work

---

## Complete Deployment Workflow

### iOS Deployment Workflow

```bash
# 1. Bump the user-facing version in app.json if this is a user-facing release.
# Do NOT set ios.buildNumber - it is managed remotely (autoIncrement).

# 2. Build for production
eas build --profile production --platform ios

# 3. Wait for build to complete (check status)
eas build:list

# 4. Download the IPA
eas build:download --platform ios --latest

# 5. Upload to App Store Connect using Transporter
# Open Transporter → Add IPA → Deliver

# 6. Configure in App Store Connect
# Go to appstoreconnect.apple.com
# Select build → Add to TestFlight or App Store
# Fill in metadata and submit for review
```

### Android Deployment Workflow

```bash
# 1. Bump the user-facing version in app.json if this is a user-facing release.
# Do NOT set android.versionCode - it is managed remotely (autoIncrement).

# 2. Build for production
eas build --profile production --platform android

# 3. Wait for build to complete
eas build:list

# 4. Download the AAB
eas build:download --platform android --latest

# 5. Upload to Play Console
# Go to play.google.com/console
# Select app → Production/Testing → Create release
# Upload AAB → Add release notes → Review → Roll out

# 6. Monitor rollout
# Check Play Console for crash reports and user feedback
```

---

## iOS-Specific Details

### App Store Connect Overview

**URL**: [appstoreconnect.apple.com](https://appstoreconnect.apple.com)

#### Main Sections

1. **My Apps** → Select ReadyNow
2. **TestFlight** → Manage beta testing
3. **App Store** → Manage production releases
4. **Activity** → View submission status

### TestFlight Internal Testing

**Purpose**: Quick testing with up to 100 internal testers (your team)

**Steps:**
1. Upload build via Transporter
2. Go to **TestFlight** tab
3. Build appears automatically after processing (5-10 min)
4. Click on the build
5. Add internal testers (must have App Store Connect access)
6. Testers receive email → Install TestFlight app → Download build

**No review required** for internal testing!

### TestFlight External Testing

**Purpose**: Beta testing with up to 10,000 external testers (public)

**Steps:**
1. Upload build via Transporter
2. Go to **TestFlight** → **External Testing**
3. Create a test group
4. Add the build to the group
5. **Submit for Beta App Review** (required!)
6. Add testers via email or public link
7. Wait for Beta App Review approval (usually 24-48 hours)
8. Testers can install after approval

### Production Release

**Steps:**
1. Upload build via Transporter
2. Go to **App Store** tab
3. Click "+" to add new version
4. Fill in **What's New** (release notes)
5. Select the build
6. Complete all metadata (if first release):
   - App Name
   - Subtitle (30 characters)
   - Description
   - Keywords
   - Screenshots (required sizes):
     - 6.7" iPhone (1290 x 2796)
     - 6.5" iPhone (1284 x 2778)
     - 5.5" iPhone (1242 x 2208)
     - 12.9" iPad Pro (2048 x 2732)
   - App Icon (1024 x 1024)
   - Privacy Policy URL
   - Support URL
   - Marketing URL (optional)
7. Submit for review
8. Wait for approval (24-48 hours typically)
9. Release manually or automatically after approval

### Using Transporter

**Transporter** is Apple's official tool for uploading builds.

#### Installation

- Download from Mac App Store: [Transporter](https://apps.apple.com/us/app/transporter/id1450874784)
- Or use command line: `xcrun altool` (requires Xcode)

#### Upload Steps

1. **Launch Transporter**
   ```
   Open Transporter from Applications
   ```

2. **Sign In**
   - Use your Apple ID (Apple Developer account email)
   - Use app-specific password if 2FA is enabled
   - Generate app-specific password at [appleid.apple.com](https://appleid.apple.com)

3. **Add IPA File**
   - Click "+" button
   - Or drag and drop the `.ipa` file
   - Transporter validates the file

4. **Deliver**
   - Click "Deliver" button
   - Upload progress shows in real-time
   - Wait for "Delivered" status

5. **Verify in App Store Connect**
   - Go to App Store Connect
   - Navigate to TestFlight or App Store
   - Build appears after processing (5-15 minutes)
   - Status shows "Processing" → "Ready to Submit"

#### Transporter Troubleshooting

**Error: "Asset validation failed"**
- Check bundle identifier matches App Store Connect
- Verify version/build number is higher than previous
- Ensure all required icons are included

**Error: "Authentication failed"**
- Use app-specific password (not regular password)
- Generate at appleid.apple.com → Security → App-Specific Passwords

**Error: "Invalid provisioning profile"**
- Rebuild with EAS (handles provisioning automatically)
- Or manually update in Apple Developer Portal

---

## Android-Specific Details

### Google Play Console Overview

**URL**: [play.google.com/console](https://play.google.com/console)

#### Main Sections

1. **Dashboard** → Overview and metrics
2. **Release** → Manage releases (production, testing)
3. **Testing** → Internal testing, closed testing, open testing
4. **Users and feedback** → Reviews and crash reports

### Internal Testing Track

**Purpose**: Quick testing with up to 100 internal testers

**Steps:**
1. Go to **Testing** → **Internal testing**
2. Click "Create new release"
3. Upload `.aab` file
4. Add release notes
5. Review and "Start rollout to Internal testing"
6. Copy the opt-in URL
7. Share URL with testers
8. Testers opt-in → Install from Play Store

**No review required** for internal testing!

### Closed Testing (Beta)

**Purpose**: Beta testing with specific testers (up to 100,000)

**Steps:**
1. Go to **Testing** → **Closed testing**
2. Create a testing track (e.g., "beta")
3. Click "Create new release"
4. Upload `.aab` file
5. Add release notes
6. Review and roll out
7. Add testers:
   - Email list (CSV upload)
   - Google Groups
   - Public opt-in link
8. Testers receive notification or use opt-in link

### Production Release

**Steps:**
1. Go to **Release** → **Production**
2. Click "Create new release"
3. Upload `.aab` file
4. Add release notes (in all supported languages)
5. Review the release
6. Choose rollout strategy:
   - **Staged rollout**: 20% → 50% → 100% (recommended)
   - **Full rollout**: 100% immediately
7. Click "Start rollout to Production"
8. Monitor crash reports and reviews
9. Increase rollout percentage if stable

### Play Store Listing Requirements

Complete before first production release:

#### Store Listing

- **App name**: Up to 30 characters
- **Short description**: Up to 80 characters
- **Full description**: Up to 4000 characters
- **App icon**: 512 x 512 PNG
- **Feature graphic**: 1024 x 500 JPG/PNG
- **Screenshots**: 
  - Phone: At least 2 (up to 8)
  - 7" tablet: At least 2 (up to 8)
  - 10" tablet: At least 2 (up to 8)
- **App category**: Choose primary and secondary
- **Tags**: Up to 5 tags

#### Data Safety

**Critical**: Must complete Data Safety form

1. Go to **App content** → **Data safety**
2. Answer questions about:
   - Data collection (what data you collect)
   - Data sharing (who you share with)
   - Data security (encryption, deletion)
   - Data usage (why you collect it)
3. For ReadyNow, declare:
   - Location data collection
   - Contact information
   - Personal information
   - All data is encrypted
   - User can request deletion

#### Content Rating

1. Go to **App content** → **Content rating**
2. Complete questionnaire
3. Receive rating (e.g., Everyone, Teen, Mature)

#### Target Audience

1. Go to **App content** → **Target audience**
2. Select age groups
3. Declare if app is designed for children

---

## Build Profiles Explained

### Development Profile

```json
{
  "development": {
    "developmentClient": true,
    "distribution": "internal",
    "environment": "development"
  }
}
```

**Characteristics:**
- Includes dev tools and debugging
- Can run on simulators
- Faster build times
- Not suitable for App Store/Play Store

**Use when**: Active development, debugging, testing new features

### Preview Profile

```json
{
  "preview": {
    "distribution": "internal",
    "environment": "preview"
  }
}
```

**Characteristics:**
- Production-like build
- No dev tools
- iOS: ad-hoc signed - installs only on devices registered to the team
- **Cannot be uploaded to TestFlight or the App Store**
- Android: installable APK/AAB for the Internal Testing track

**Use when**: Android internal testing, demos on registered iOS devices

### TestFlight Profile

```json
{
  "testflight": {
    "distribution": "store",
    "autoIncrement": true,
    "environment": "preview"
  }
}
```

**Characteristics:**
- App Store-signed, so it uploads to App Store Connect and reaches TestFlight
- Draws from the `preview` environment: NILRA staging, staging Twilio handlers
- Shares the remote build-number counter with `production`

**Use when**: TestFlight betas, NILRA referral testing, any beta that must not
write to live systems

### Production Profile

```json
{
  "production": {
    "distribution": "store",
    "autoIncrement": true,
    "environment": "production"
  }
}
```

`distribution` defaults to `store`, so it is not set explicitly.
`autoIncrement` bumps the build number; combined with `appVersionSource:
"remote"` the counter lives on EAS, not in `app.json`.

**Characteristics:**
- Optimized for production
- No debugging tools
- App Store-signed - the only profile TestFlight accepts
- Required for App Store/Play Store
- Smallest bundle size

**Use when**: TestFlight betas, public releases, App Store/Play Store submissions

---

## Useful Commands Reference

### EAS Build Commands

```bash
# Check build status
eas build:list

# View specific build
eas build:view [BUILD_ID]

# Cancel build
eas build:cancel

# Download build
eas build:download --id [BUILD_ID]

# Re-run failed build
eas build:resign --id [BUILD_ID]

# View build logs
eas build:view [BUILD_ID] --logs
```

### EAS Submit Commands

```bash
# Submit to stores
eas submit --platform ios --latest
eas submit --platform android --latest

# Check submission status
eas submit:list

# View submission details
eas submit:view [SUBMISSION_ID]
```

### EAS Credentials Commands

```bash
# View credentials
eas credentials

# Configure iOS credentials
eas credentials --platform ios

# Configure Android credentials
eas credentials --platform android
```

### Version Management Commands

```bash
# View current version
grep -A 5 '"version"' app.json

# Auto-increment during build
eas build --platform ios --auto-increment
```

---

## Troubleshooting

### Common Build Errors

#### "Build failed: Missing credentials"

```bash
# Configure credentials
eas credentials --platform ios
# or
eas credentials --platform android
```

#### "Build failed: Version code must be incremented"

Build numbers live on EAS, not in `app.json`. Editing `app.json` will not fix
this. Inspect and correct the remote value:

```bash
eas build:version:get --platform ios
eas build:version:set --platform ios
```

This usually means a build was uploaded to the store outside EAS, so the
store's highest build number is ahead of the EAS counter.

#### "Build failed: Invalid bundle identifier"

Verify `app.json` matches App Store Connect/Play Console:
- iOS: `ios.bundleIdentifier`
- Android: `android.package`

### Common Upload Errors

#### Transporter: "This bundle is invalid"

- Ensure version/build number is higher than previous
- Check that bundle ID matches App Store Connect
- Verify all required icons are included

#### Play Console: "Upload failed"

- Ensure `.aab` file (not `.apk`)
- Check that version code is higher than previous
- Verify signing key matches previous releases

### Common Review Rejections

#### iOS App Review

**Rejection: "App crashes on launch"**
- Test on physical device before submitting
- Check crash logs in App Store Connect
- Fix and resubmit

**Rejection: "Missing privacy policy"**
- Add privacy policy URL in App Store Connect
- Ensure URL is accessible and complete

**Rejection: "Incomplete metadata"**
- Fill in all required fields
- Add screenshots for all device sizes
- Provide clear, accurate descriptions

#### Android Review

**Rejection: "Data Safety form incomplete"**
- Complete all sections of Data Safety
- Be specific about data collection
- Declare encryption and security measures

**Rejection: "Missing content rating"**
- Complete content rating questionnaire
- Provide accurate answers
- Resubmit after receiving rating

---

## Best Practices

### Before Every Release

- [ ] Test on physical devices (iOS and Android)
- [ ] Update version numbers in `app.json`
- [ ] Update release notes
- [ ] Test emergency alert functionality
- [ ] Verify translations in all languages
- [ ] Check that all API endpoints are working
- [ ] Review crash reports from previous version
- [ ] Test biometric authentication
- [ ] Verify data encryption is working

### Version Numbering Strategy

**For Production Releases:**
- Major version (1.0.0 → 2.0.0): Major features, redesigns
- Minor version (1.0.0 → 1.1.0): New features, improvements
- Patch version (1.0.0 → 1.0.1): Bug fixes, minor updates

**For TestFlight/Internal Testing:**
- Keep same version number
- Increment build number only
- Example: v1.2.0 (build 45) → v1.2.0 (build 46)

### Staged Rollout Strategy

**Recommended for Android:**
1. Release to 20% of users
2. Monitor for 24-48 hours
3. Increase to 50% if stable
4. Monitor for 24 hours
5. Increase to 100%

**Benefits:**
- Catch critical bugs before full rollout
- Limit impact of issues
- Easy to pause/halt if problems arise

### Monitoring After Release

**iOS:**
- Check App Store Connect → Analytics
- Monitor crash reports in Xcode Organizer
- Review user feedback in App Store Connect
- Check Sentry for error tracking

**Android:**
- Check Play Console → Dashboard
- Monitor crash reports in Play Console
- Review user ratings and reviews
- Check Android vitals (ANR, crashes)
- Use Sentry for detailed error tracking

---

## Quick Reference

### Build for TestFlight (iOS)

```bash
eas build --profile testflight --platform ios
```

```bash
eas submit --profile testflight --platform ios --latest
```

Uses the `testflight` profile: App Store-signed so it can be uploaded, but
drawing from the `preview` environment so referrals land in NILRA's staging
database rather than the live one.

### Build for Internal Testing (Android)

```bash
eas build --profile preview --platform android
# Download AAB → Upload to Play Console Internal Testing
```

### Build for Production (Both)

```bash
# Bump "version" in app.json first if this is a user-facing release.
# Build numbers increment themselves (appVersionSource: remote).
eas build --profile production --platform all
# iOS: Download IPA → Transporter → App Store Connect
# Android: Download AAB → Play Console → Production
```

### Emergency Hotfix

```bash
# 1. Fix the bug
# 2. Increment patch version (1.2.3 → 1.2.4)
# 3. Build and submit
eas build --profile production --platform all
# 4. Submit for expedited review (iOS) or staged rollout (Android)
```

---

## Additional Resources

### Official Documentation

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [App Store Connect Help](https://developer.apple.com/app-store-connect/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Expo Application Services](https://expo.dev/eas)

### Useful Links

- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policy Center](https://play.google.com/about/developer-content-policy/)
- [TestFlight Beta Testing](https://developer.apple.com/testflight/)
- [Android App Bundle Format](https://developer.android.com/guide/app-bundle)

### Support

- **Expo Forums**: [forums.expo.dev](https://forums.expo.dev)
- **Expo Discord**: [chat.expo.dev](https://chat.expo.dev)
- **Apple Developer Support**: [developer.apple.com/support](https://developer.apple.com/support)
- **Google Play Support**: [support.google.com/googleplay/android-developer](https://support.google.com/googleplay/android-developer)

---

## Notes

- Always test builds on physical devices before submitting to stores
- Keep your signing credentials secure (EAS handles this automatically)
- Monitor crash reports and user feedback after each release
- Respond to user reviews promptly
- Keep dependencies up to date for security patches
- Follow platform-specific guidelines to avoid rejections

For development conventions and coding standards, see [CONVENTIONS.md](./CONVENTIONS.md).

