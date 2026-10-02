# ReadyNow

A secure emergency alert application built with Expo and React Native that allows users to quickly send emergency messages to their contacts with location data and legal support information.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Getting Started](#getting-started)
4. [Project Structure](#project-structure)
5. [Authentication Setup](#authentication-setup)
6. [Twilio Functions (Backend Services)](#twilio-functions-backend-services)
7. [Development Workflow](#development-workflow)
8. [CI/CD Pipeline](#cicd-pipeline)
9. [Key Features](#key-features)
10. [Architecture Decisions](#architecture-decisions)
11. [Security & Privacy](#security--privacy)
12. [Contributing](#contributing)
13. [License](#license)
14. [Expo Documentation](#expo-documentation)

## Project Overview

ReadyNow is an emergency alert application designed to help users quickly notify their emergency contacts when they need help. The app features:

- **Quick Alert System**: Press and hold the alert button to send emergency messages
- **Legal Support Integration**: Connect with legal support services through NILRA API
- **Location Sharing**: Automatically include location data in emergency messages
- **Multi-language Support**: Available in nine languages — English, Spanish, Korean,
  French, Haitian Creole, Chinese, Arabic, Dari and Pashto
- **Secure Data Storage**: All sensitive data is encrypted and stored securely
- **Device Lock Authentication**: Sensitive operations require the device's own lock — fingerprint, face, PIN, pattern or password

## Tech Stack

- **Framework**: Expo (React Native)
- **Language**: TypeScript with strict mode
- **Authentication**: Auth0 (passwordless SMS)
- **Backend**: Twilio Serverless Functions
- **Database**: DigitalOcean MySQL (for push notifications)
- **Storage**: expo-secure-store for sensitive data
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Navigation**: Expo Router (file-based routing)
- **State Management**: React Context API
- **Internationalization**: Custom translation system
- **API Integration**: REST APIs (NILRA API)
- **Push Notifications**: Expo Push Notifications + Twilio Functions
- **Security**: Device lock authentication, data encryption

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (for iOS development) or Android Studio (for Android development)
- Auth0 account for authentication

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd readynow
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment variables (contact team for credentials)

4. Configure Firebase for Android push notifications:

   ```bash
   # Copy the template file
   cp app/google-services.json.template app/google-services.json
   
   # Contact team for the actual google-services.json file
   # Or download it from Firebase Console → Project Settings → Your apps
   ```

   **Important Security Notes:**
   - `app/google-services.json` is listed in `.gitignore` and must never be
     committed. It was tracked in this repository until the commit that added
     this note, so the key it contained is present in the git history and
     should be treated as disclosed.
   - Ensure API key restrictions are set in [Google Cloud Console](https://console.cloud.google.com):
     - Restrict to Android apps only
     - Add your app's SHA-1 fingerprint
     - Restrict to package name: `com.innovationlab.alertbuttonexpo`
   - While Firebase API keys are designed to be in apps, restrictions prevent unauthorized use

   EAS Build never sees this file - it only uploads what git tracks. Android
   builds pull it from a file-type EAS environment variable
   (`GOOGLE_SERVICES_JSON`, one per environment) via the `eas-build-pre-install`
   hook in `package.json`, which copies it to `app/google-services.json`
   before the native build reads `app.json`.

5. Start the development server:

   ```bash
   npm start
   ```

5. Follow the instructions in the terminal to run the app on your device or simulator.

### Running the App

- **iOS Simulator**: Press `i` in the terminal or scan the QR code with your iPhone
- **Android Emulator**: Press `a` in the terminal or scan the QR code with your Android device
- **Expo Go**: Scan the QR code with the Expo Go app

## Project Structure

```text
app/
├── components/            # Shared React Native components
│   ├── AlertButton.tsx    # Main alert button component
│   ├── Button.tsx         # Reusable button component
│   ├── CustomModal.tsx    # Modal components
│   └── ...
├── screens/               # Screen components
│   ├── emergency-plan/    # Emergency plan setup screens
│   ├── welcome/          # Welcome/onboarding screens
│   ├── settings.tsx      # Settings screen
│   └── ...
├── utils/                 # Utility functions
│   ├── auth-service.ts   # Authentication utilities
│   ├── storage-utils.ts  # SecureStore operations
│   ├── encryption-utils.ts # Data encryption
│   ├── app-settings.tsx  # App configuration
│   └── ...
├── services/             # External API services
│   └── nilra-api.ts      # NILRA API integration
├── translations/         # Internationalization
│   ├── index.ts         # Translation utilities
│   ├── alert-button.json # Alert button translations
│   ├── main.json        # Main app translations
│   └── ...
├── context/             # React Context providers
│   └── ModalContext.tsx  # Modal state management
├── types/               # TypeScript type definitions
│   └── all-topics.ts    # Topic definitions
└── _layout.tsx          # Root layout component
```

### Key Files

- **`app/components/AlertButton.tsx`**: Main emergency alert button with press handling and animations
- **`app/utils/storage-utils.ts`**: Secure data storage with encryption and chunking
- **`app/services/nilra-api.ts`**: Legal support API integration
- **`app/utils/auth-service.ts`**: Auth0 authentication service
- **`app/translations/index.ts`**: Translation system implementation

## Authentication Setup

The app uses Auth0 for phone-based authentication with SMS verification codes.

### 1. Create an Auth0 Account and Application

1. Sign up or log in to [Auth0](https://auth0.com/)
2. Create a new application:
   - Select "Native" as the application type
   - Name it appropriately (e.g., "ReadyNow App")

### 2. Configure Auth0 Settings

#### Enable Passwordless SMS Login

1. Go to **Authentication** > **Passwordless**
2. Enable the **SMS** option
3. Configure the SMS provider (Twilio or another provider)

#### Configure Callback URLs

1. In your Auth0 application settings, add the following to "Allowed Callback URLs":

   ```text
   myapp://callback
   ```

#### Configure Mobile Settings

1. Under the application settings, scroll to "Mobile Settings"
2. If you're planning to publish to iOS App Store, add your Bundle Identifier
3. If you're planning to publish to Google Play, add your Package Name

### 3. Update App Configuration

1. Open `app/utils/auth-config.ts`
2. Replace the placeholders with your Auth0 credentials:

   ```typescript
   export const AUTH0_CONFIG = {
     domain: "YOUR_AUTH0_DOMAIN", // e.g. 'your-tenant.us.auth0.com'
     clientId: "YOUR_AUTH0_CLIENT_ID",
     audience: "https://YOUR_AUTH0_DOMAIN/api/v2/",

     // Connection settings
     connection: "sms",

     // Redirect URI (keep as is)
     redirectUri: "myapp://callback",
   };
   ```

### Authentication Flow

The app implements a phone-based authentication flow:

1. User enters their phone number on the login/signup screen
2. A 6-digit verification code is sent to their phone via SMS
3. User enters the code to complete authentication
4. On successful verification, the user is directed to the appropriate screen based on their onboarding status

## Twilio Functions (Backend Services)

ReadyNow uses Twilio Serverless Functions as the backend infrastructure for secure, scalable API endpoints. These functions act as secure proxies and handle sensitive operations server-side.

### Deployed Functions

The following Twilio Functions are deployed and managed through the Twilio Console:

#### 1. **nilra-api** (Production) / **nilra-api-staging**
- **Purpose**: Secure proxy for NILRA (legal support) API integration
- **Endpoints**:
  - Production: `EXPO_PUBLIC_TWILIO_NILRA_HANDLER_URL`
  - Staging: `EXPO_PUBLIC_TWILIO_NILRA_HANDLER_URL` (staging variant)
- **Authentication**: Requires `TWILIO_API_SECRET` + `NILRA_API_KEY` (server-side)
- **Functionality**:
  - Forwards legal support intake data to NILRA API
  - Keeps NILRA API credentials secure on server
  - Transforms data to NILRA's required format
  - Returns submission status to the app

   **Note for NILRA API Testing:**
   - The environment file contains both staging and production NILRA credentials
   - To test with staging API, comment out production credentials and uncomment staging credentials
   - Always revert to production credentials before deploying to App Store/Play Store
   - See environment file for specific variable names

**Switching between Staging and Production:**
- The app environment file contains both staging and production NILRA URLs
- To test with staging: Comment out production URL, uncomment staging URL
- Always revert to production before deploying to app stores

#### 2. **countries**
- **Purpose**: Fetches list of countries from NILRA API
- **Endpoint**: `EXPO_PUBLIC_TWILIO_COUNTRIES_URL`
- **Authentication**: Requires `TWILIO_API_SECRET`
- **Functionality**:
  - Retrieves country list for "Country of Birth" dropdown
  - Caches results to minimize API calls
  - Provides localized country names

#### 3. **notification-manager**
- **Purpose**: Manages push notification device tokens and dispatches notifications
- **Endpoint**: `EXPO_PUBLIC_TWILIO_NOTIFICATION_HANDLER_URL`
- **Authentication**: Requires `TWILIO_API_SECRET`
- **Database**: DigitalOcean MySQL
- **Functionality**:
  - **Register**: Stores device push tokens in database
  - **Disable**: Removes device tokens from database
  - **Dispatch**: Sends push notifications to all registered devices
  - Integrates with Expo Push Notification Service
  - Supports localized notification content

### Twilio Function Authentication

All Twilio Functions use a shared API secret for authentication:

- **Environment Variable**: `EXPO_PUBLIC_TWILIO_API_SECRET`
- **Transmission**: Sent in request body as `apiKey` field
- **Validation**: Each function validates the secret before processing requests
- **Security**: Keep this secret secure; it authorizes all app-to-function communication

### Function Dependencies

Each function requires specific environment variables configured in the Twilio Console:

**Common Variables (All Functions):**
- `TWILIO_API_SECRET`: Shared secret for app authentication

**notification-manager Specific:**
- `DO_MYSQL_HOST`: DigitalOcean MySQL host
- `DO_MYSQL_USER`: Database username
- `DO_MYSQL_PASSWORD`: Database password
- `DO_MYSQL_DATABASE`: Database name
- `DO_MYSQL_PORT`: Database port (default: 25060)
- `EXPO_ACCESS_TOKEN`: Expo push service access token

**nilra-api Specific:**
- `NILRA_API_KEY`: NILRA API credentials (kept server-side)
- `NILRA_COUNTRIES_URL`: NILRA countries API endpoint

### Managing Twilio Functions

**Twilio Console**: [console.twilio.com](https://console.twilio.com)

1. Navigate to **Functions & Assets** → **Services**
2. Select your service (e.g., "readynow-functions")
3. Each function has:
   - Code editor for function logic
   - Environment Variables configuration
   - Dependencies (Node packages)
   - Deployment history

**Deploying Changes:**

Functions are deployed from this repository with the Serverless Toolkit, not
edited in the Console. See [Twilio Functions Deployment](DEPLOYMENT.md#twilio-functions-deployment).

```bash
cd twilio && twilio serverless:deploy --production --service-sid ZSxxxxxxxx
```

**Viewing Logs:**
- Go to **Functions & Assets** → **Services** → Select function
- Click **Logs** to view execution logs
- Use `console.log()` in functions for debugging
- Logs show request details, errors, and responses

**Testing Functions:**
Use `curl` to test endpoints directly:
```bash
curl -X POST https://<service-name>-<digits>.twil.io/<path> \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"your-api-secret","action":"test"}'
```

### Sending Push Notifications

To send push notifications to all registered devices, use the notification-manager function with the `dispatch` action:

```bash
curl -X POST YOUR_TWILIO_NOTIFICATION_HANDLER_URL \
  -H "Content-Type: application/json" \
  -d '{
        "action": "dispatch",
        "apiKey": "YOUR_TWILIO_API_SECRET",
        "payload": {
          "title": {
            "en": "Emergency Alert",
            "es": "Alerta de Emergencia",
            "kr": "긴급 알림"
          },
          "body": {
            "en": "Important update from ReadyNow",
            "es": "Actualización importante de ReadyNow",
            "kr": "ReadyNow의 중요한 업데이트"
          },
          "data": {
            "alertType": "broadcast",
            "timestamp": "2025-11-20T12:00:00Z"
          },
          "sound": "default",
          "priority": "high"
        }
      }'
```

**Notification Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `title` | String or Object | Notification title (supports multiple languages) |
| `body` | String or Object | Notification body text (supports multiple languages) |
| `data` | Object | Custom data payload (accessible in the app) |
| `sound` | String | Notification sound (default: "default") |
| `priority` | String | Notification priority ("default", "normal", "high") |

**Localization:**
- Single language: `"title": "Alert"`
- Multi-language: `"title": {"en": "Alert", "es": "Alerta", "kr": "알림"}`
- The function uses English (`en`) as fallback if user's language isn't provided

**Response:**
```json
{
  "success": true,
  "tickets": ["..."],
  "dispatchedCount": 150,
  "errors": []
}
```

**Important Notes:**
- Never commit Twilio API secrets to version control
- Test functions thoroughly before deploying
- Monitor function logs after deployment
- Functions have execution time limits (10 seconds default)
- Large payloads may need chunking or optimization
- Always test push notifications with a small group before broadcasting to all users

## Development Workflow

### Code Conventions

This project follows strict coding conventions to ensure consistency, maintainability, and security. Please read and follow our **[CONVENTIONS.md](./CONVENTIONS.md)** document before contributing.

Key points:

- TypeScript with strict mode enabled
- Security-first approach with encrypted data storage
- Platform-specific code handling (iOS vs Android)
- Comprehensive error handling
- Multi-language support

### Testing Approach

- Use TypeScript strict mode for type safety
- Test on both iOS and Android platforms
- Verify security features (encryption, device lock auth)
- Test emergency alert functionality thoroughly
- Validate translation system with multiple languages

### Building for Production

1. **iOS Build**:

   ```bash
   eas build --platform ios
   ```

2. **Android Build**:

   ```bash
   eas build --platform android
   ```

3. **Submit to App Stores**:

   ```bash
   eas submit --platform ios
   eas submit --platform android
   ```

## CI/CD Pipeline

This repository uses GitHub Actions for continuous integration with comprehensive testing and coverage tracking.

### Workflow Overview

The CI pipeline runs on every push and pull request to `main` and `develop` branches with the following jobs:

#### 1. DCO Sign-off (`dco`)

- Verifies every commit in the PR carries a `Signed-off-by` trailer matching
  its author — see [DCO.md](./DCO.md)
- Merge commits and bot commits (Dependabot, Renovate) are exempt
- Only runs on pull requests: once a branch is merged there is nothing left to amend
- On failure, the run summary shows exactly which commits are missing a
  sign-off and the command to fix them

#### 2. TypeScript Type Check (`type-check`)

- Runs `tsc --noEmit` to catch type errors without generating output files
- Ensures all TypeScript code is properly typed
- Fails if any type errors are found

#### 3. Unit Tests (`test`)

- Runs Jest tests with coverage collection
- Uses `jest-expo` preset for React Native compatibility
- Generates coverage reports in multiple formats (text, lcov, json, html)
- Uploads coverage artifacts for later analysis

#### 4. E2E Tests (`e2e-tests`)

- Runs Playwright end-to-end tests
- Tests against multiple browsers (Chrome, Firefox, Safari)
- Includes mobile viewport testing
- Generates HTML reports and uploads artifacts

#### 5. Coverage Check (`coverage-check`)

- Compares current coverage against baseline
- Comments on PRs with detailed coverage reports
- Fails if coverage drops by more than 5%
- Only runs on pull requests

#### 6. Dependency Audit (`audit`)

- Runs `npm audit` and posts the result to the run summary
- Advisory for transitive toolchain findings; blocking for a critical
  advisory in a *direct* dependency

### Coverage Configuration

#### Collection Scope

Coverage is collected from:

- `app/components/**/*.{ts,tsx}`
- `app/screens/**/*.{ts,tsx}`
- `app/services/**/*.{ts,tsx}`
- `app/utils/**/*.{ts,tsx}`
- `app/context/**/*.{ts,tsx}`

#### Excluded Files

- `app/translations/` - Translation files and barrel exports
- `**/*.d.ts` - Type declaration files
- `**/*.json` - JSON configuration files
- `node_modules/` and `coverage/` directories

#### Regression Detection

- **Threshold**: 5% coverage regression
- **Action**: Job fails if any metric drops by >5%
- **Notification**: PR comments with detailed coverage table
- **Baseline**: Stored in `.github/coverage-baseline.json`

### Running Tests Locally

```bash
# Run all tests in watch mode
npm test

# Run tests once with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Type check only
npm run type-check
```

### Updating Coverage Baseline

The baseline update is **not automatic** - it's a manual process that you control. Update the baseline when you've added significant new tests or reached a coverage milestone you're happy with.

#### Method 1: Automated Script (Recommended)

```bash
# 1. Run tests with coverage
npm run test:coverage

# 2. Update baseline automatically
npm run coverage:update-baseline

# 3. Commit the changes
git add .github/coverage-baseline.json
git commit -m "Update coverage baseline"
git push
```

#### Method 2: Manual Update

```bash
# 1. Run tests with coverage
npm run test:coverage

# 2. Copy values from coverage/coverage-summary.json to .github/coverage-baseline.json
# 3. Commit and push
```

**When to Update the Baseline:**

- ✅ You've added significant new tests
- ✅ You've reached a coverage milestone you're happy with
- ✅ You want to "lock in" current coverage levels
- ✅ After major refactoring that improves test coverage

**Don't update the baseline when:**

- ❌ Coverage drops due to new untested code
- ❌ You're in the middle of adding tests
- ❌ You want to maintain pressure to improve coverage

### Test Structure

#### Unit Tests

- Located in `__tests__` directories alongside components
- Use `@testing-library/react-native` for component testing
- Mock Expo modules and external dependencies
- Follow naming convention: `ComponentName.test.tsx`

#### E2E Tests

- Located in `e2e/` directory
- Use Playwright for browser automation
- Test critical user flows and navigation
- Include mobile and desktop viewport testing

### Troubleshooting

#### Common Issues

1. **Tests failing due to Expo modules**

   - Check `jest.setup.js` for proper mocking
   - Add new mocks as needed for Expo modules

2. **Coverage not collecting**

   - Verify `collectCoverageFrom` patterns in `jest.config.js`
   - Check that files are not excluded by patterns

3. **E2E tests timing out**

   - Increase timeout in `playwright.config.ts`
   - Check that Expo dev server is starting properly

4. **Coverage comparison failing**
   - Ensure `coverage/coverage-summary.json` exists
   - Check that baseline file has valid JSON structure

#### Debug Commands

```bash
# Debug Jest configuration
npx jest --showConfig

# Debug Playwright configuration
npx playwright test --list

# Check coverage collection
npm run test:coverage && cat coverage/coverage-summary.json
```

## Key Features

### Emergency Alert System

- **Press and Hold**: Hold the alert button for 1.5 seconds to trigger
- **Countdown Confirmation**: 3-second countdown with cancellation option
- **Message Delivery**: Sends SMS messages to all configured emergency contacts
- **Location Inclusion**: Automatically includes current location in messages

### Legal Support Integration

- **NILRA API**: Connects with legal support services
- **Intake Forms**: Collects necessary legal information
- **Location Sharing**: Shares location with legal support when enabled
- **Contact Information**: Manages emergency contact details

### Security Features

- **Device Lock Authentication**: Protect sensitive operations
- **Data Encryption**: All sensitive data is encrypted before storage
- **Secure Storage**: Uses expo-secure-store for sensitive data
- **Data Wiping**: Automatically wipes data after alert is sent
- **iOS Backup Exclusion**: Prevents sensitive data from being backed up

### Multi-language Support

- **Languages**: English (`en`), Spanish (`es`), Korean (`kr`), French (`fr`),
  Haitian Creole (`ht`), Chinese (`zh`), Arabic (`ar`), Dari (`dr`), Pashto (`ps`)
- **Dynamic Translation**: Real-time language switching
- **Cultural Adaptation**: Region-specific formatting and messaging

## Architecture Decisions

### Security-First Design

- All sensitive data is encrypted before storage
- Device lock authentication for sensitive operations
- Automatic data wiping after emergency alerts
- Platform-specific security implementations

### Data Management

- **Chunking Strategy**: Large data is split into chunks for SecureStore compatibility
- **Format Versioning**: Data migration system for format updates
- **Encryption**: XChaCha20-Poly1305 authenticated encryption (AEAD) for sensitive data
- **Backup Exclusion**: iOS-specific backup exclusion for sensitive data

### Performance Optimization

- **Native Animations**: Uses React Native Animated API
- **Memory Management**: Proper cleanup of timers and subscriptions
- **Platform Optimization**: iOS and Android specific optimizations
- **Efficient Storage**: Chunked storage for large data sets

### Error Handling

- **Graceful Degradation**: App continues to function even if some features fail
- **User-Friendly Messages**: Error messages don't expose sensitive information
- **Platform-Specific Handling**: Different error handling for iOS vs Android
- **Comprehensive Logging**: Detailed logging for debugging without sensitive data

## Security & Privacy

### Data Protection

- **Encryption**: Emergency plan data is encrypted with XChaCha20-Poly1305 (AEAD), using a random 24-byte nonce per record and a 32-byte key held in the platform keystore. Authentication means a modified record fails to decrypt rather than silently returning altered contact details.
- **Secure Storage**: Uses expo-secure-store for sensitive data
- **Device Lock Protection**: Opening the emergency plan or wiping it requires
  authenticating against the device's own lock. Biometrics are used where
  enrolled; a PIN, pattern or password is accepted otherwise, so the protection
  does not disappear on a handset with no fingerprint sensor. A device with no
  lock screen configured has no credential to check, and is the one case where
  the operation proceeds unauthenticated.
- **Data Wiping**: Automatic data cleanup after emergency alerts

### Privacy Considerations

- **Minimal Data Collection**: Only collects necessary information
- **No Advertising or Analytics**: No advertising SDKs, no behavioural analytics, no third-party trackers
- **Opt-in Crash Reporting**: Crash reporting (Sentry) is off until the user explicitly enables it, and reports never contain names, phone numbers, emails, A-Numbers, dates of birth, plan contents, contacts, location, or IP addresses. See [docs/crash-reporting.md](./docs/crash-reporting.md)
- **Emergency Plan Stays on the Device**: Plan contents are encrypted and never leave the device. Data is transmitted only when the user takes an action that requires it — sending an alert, submitting a legal-support intake to NILRA, or sending feedback
- **Transparent Usage**: Clear information about data usage

### Security Best Practices

- **Input Validation**: All user inputs are validated
- **API Security**: Secure API communication with proper authentication
- **Platform Security**: Leverages platform-specific security features
- **Regular Updates**: Regular security updates and dependency management

## Contributing

Contributions are welcome. ReadyNow is used by people who may be in genuine
danger, so reliability and privacy come before features — read
**[CONTRIBUTING.md](./CONTRIBUTING.md)** before you start. It covers setup, the
review process, what we most need help with, and what is deliberately out of
scope.

| If you want to... | Read |
| --- | --- |
| Make your first contribution | [docs/good-first-contributions.md](./docs/good-first-contributions.md) |
| Understand the code style | [CONVENTIONS.md](./CONVENTIONS.md) |
| Fix or review a translation | [docs/translation-review.md](./docs/translation-review.md) |
| Report a security vulnerability | [SECURITY.md](./SECURITY.md) — **never** open a public issue |
| Get help using the app | [SUPPORT.md](./SUPPORT.md) |
| Report a bug or suggest a feature | [Open an issue](https://github.com/Human-Rights-First-Innovation-Lab/readynow/issues/new/choose) |

In short:

1. Fork, and branch from `develop` as `<yourname>/<type>/<short-description>`
2. Follow [CONVENTIONS.md](./CONVENTIONS.md); TypeScript strict mode must pass
3. Test on a real device or emulator, and say which one in the PR
4. Sign off your commits with `git commit -s` — see [DCO.md](./DCO.md)
5. Open a pull request against `develop`, not `main`

Never commit secrets, API keys, or real phone numbers. Any new user-facing
string needs an entry in all nine languages in `app/translations/`. Certain
paths — `twilio/`, encryption, crash reporting, the alert send path — need a
maintainer's review; see [.github/CODEOWNERS](./.github/CODEOWNERS) and the
constraints described in [CONTRIBUTING.md](./CONTRIBUTING.md).

ReadyNow is maintained by the Human Rights First Innovation Lab, which makes
the final call on what merges. Expect a first response within about a week.

Everyone participating is expected to follow the
[Code of Conduct](./CODE_OF_CONDUCT.md).

## License

ReadyNow is licensed under the [Apache License 2.0](./LICENSE). See
[NOTICE](./NOTICE) for attribution requirements.

## Expo Documentation

## Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
    npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
  