# iOS App — Production Readiness

Checklist and steps to ship the Idea Home iOS app to the App Store.

## Done in codebase

- **Bundle ID**: `com.ideahomeapp` (set in Xcode; matches Android)
- **API**: App uses `IDEAHOME_API_ORIGIN` from `@ideahome/shared-config` (production: `https://ideahome.vercel.app`)
- **Info.plist**: No unused permission keys; camera, microphone, photo library usage descriptions set for issue attachments
- **ATS**: App Transport Security allows HTTPS only; local networking allowed for dev
- **Launch screen**: "Idea Home" only (no framework branding)
- **Privacy manifest**: `PrivacyInfo.xcprivacy` present with required API declarations
- **URL scheme**: `ideahome://` for OAuth redirect
- **Deployment target**: iOS 15.1+

## You need to do

### 1. App icon

App Store requires a 1024×1024 app icon. The asset catalog is at:

`app/ios/IdeaHomeApp/Images.xcassets/AppIcon.appiconset/`

- Add a 1024×1024 PNG (no transparency, no rounded corners).
- In Xcode: open the asset catalog → AppIcon → drag in the 1024 image; Xcode can generate other sizes, or add each size per the `Contents.json` slots (20pt @2x/3x, 29pt @2x/3x, 40pt @2x/3x, 60pt @2x/3x, 1024pt 1x for marketing).

### 2. Apple Developer account and signing

- Enroll in [Apple Developer Program](https://developer.apple.com/programs/) if needed.
- In Xcode: select the **IdeaHomeApp** project → **Signing & Capabilities**.
- Set **Team** to your Apple Developer team.
- Ensure **Automatically manage signing** is on (or configure provisioning profiles manually).
- Use the same team for Debug and Release.

### 3. Release build and archive

From repo root (with dependencies installed):

```bash
cd app
pnpm install
```

**Option A — Archive from Xcode (recommended)**

1. Open `app/ios/IdeaHomeApp.xcworkspace` in Xcode (not the `.xcodeproj`).
2. Select **Any iOS Device (arm64)** as the run destination (not a simulator).
3. **Product → Archive**.
4. When the Organizer appears, **Distribute App** → **App Store Connect** (or TestFlight / Ad Hoc as needed).

**Option B — Command-line bundle (for CI or scripted builds)**

Release build embeds the JS bundle via the "Bundle React Native code and images" build phase. For a standalone bundle (e.g. for inspection):

```bash
cd app
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output ios/main.jsbundle
```

Normal release builds through Xcode run the same bundling automatically.

### 4. Version and build number

- **Marketing version** (e.g. 1.0): `app/ios/IdeaHomeApp.xcodeproj/project.pbxproj` → `MARKETING_VERSION = 1.0;`
- **Current project version** (build number): `CURRENT_PROJECT_VERSION = 1;` — bump for each upload to App Store Connect.

### 5. TestFlight / App Store

- Create the app in [App Store Connect](https://appstoreconnect.apple.com) with bundle ID `com.ideahomeapp`.
- After the first archive, upload via Xcode Organizer (or `xcrun altool` / Fastlane).
- Fill in store listing, privacy policy URL, and category; submit for review when ready.

### 6. Optional: staging API

To point the app at a staging backend, you’d need to override `IDEAHOME_APP_ORIGIN` (and thus `IDEAHOME_API_ORIGIN`) at build time. Currently `packages/shared-config` uses a single origin. Options: build-time env in Metro (e.g. `process.env.IDEAHOME_API_ORIGIN`) or a separate build scheme with a different bundled config.

## Quick reference

| Item              | Location / value                    |
|-------------------|-------------------------------------|
| Bundle ID         | `com.ideahomeapp`                    |
| Display name      | Idea Home                           |
| API origin        | `https://ideahome.vercel.app` (shared-config) |
| Min iOS           | 15.1                                |
| URL scheme        | `ideahome` (ideahome://)             |
