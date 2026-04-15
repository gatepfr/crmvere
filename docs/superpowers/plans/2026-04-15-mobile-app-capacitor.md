# Implementation Plan: Mobile App with Capacitor (CRM do Verê)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing React/Vite frontend into a native mobile application for Android and iOS using Capacitor, including automated build pipelines.

**Architecture:** Hybrid mobile application wrapping the existing web assets. Local asset loading for performance with external API communication via HTTPS.

**Tech Stack:** Capacitor 6+, React 19, Vite 8, GitHub Actions, Fastlane (iOS).

---

### Task 1: Capacitor Initialization

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/capacitor.config.ts`

- [ ] **Step 1: Install Capacitor dependencies in the frontend folder**

Run: `cd frontend && npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios`

- [ ] **Step 2: Initialize Capacitor configuration**

Run: `npx cap init "CRM do Vere" "com.crmvere.app" --web-dir dist`

- [ ] **Step 3: Update capacitor.config.ts for production**

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.crmvere.app',
  appName: 'CRM do Vere',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
```

- [ ] **Step 4: Commit initialization**

```bash
git add frontend/package.json frontend/package-lock.json frontend/capacitor.config.ts
git commit -m "feat(mobile): initialize capacitor"
```

---

### Task 2: API Environment Configuration

**Files:**
- Create: `frontend/.env.production`
- Modify: `frontend/src/api/config.ts` (or equivalent where API URL is defined)

- [ ] **Step 1: Define production API URL**

Create `frontend/.env.production`:
```env
VITE_API_URL=https://api.crmvere.com.br
```

- [ ] **Step 2: Update API service to use environment variable**

Modify `frontend/src/api/config.ts` (verify path first):
```typescript
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';
```

- [ ] **Step 3: Build frontend and verify dist folder**

Run: `cd frontend && npm run build`

- [ ] **Step 4: Commit environment changes**

```bash
git add frontend/.env.production frontend/src/api/config.ts
git commit -m "chore(mobile): configure production api url"
```

---

### Task 3: Native Platforms and Assets

**Files:**
- Create: `frontend/android/`
- Create: `frontend/ios/`
- Create: `frontend/assets/logo.png`
- Create: `frontend/assets/splash.png`

- [ ] **Step 1: Add native platforms**

Run: `cd frontend && npx cap add android && npx cap add ios`

- [ ] **Step 2: Install asset generator**

Run: `npm install @capacitor/assets --save-dev`

- [ ] **Step 3: Generate assets (Icons & Splash)**
*Note: Requires placeholder images in frontend/assets/ first.*

Run: `npx capacitor-assets generate --android --ios`

- [ ] **Step 4: Commit native folders and assets**

```bash
git add frontend/android frontend/ios frontend/assets
git commit -m "feat(mobile): add native platforms and assets"
```

---

### Task 4: Android Customizations

**Files:**
- Modify: `frontend/android/app/src/main/res/values/strings.xml`

- [ ] **Step 1: Set App Name in Android**

Ensure `strings.xml` has the correct name:
```xml
<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">CRM do Verê</string>
    <string name="title_activity_main">CRM do Verê</string>
    <string name="package_name">com.crmvere.app</string>
    <string name="custom_url_scheme">com.crmvere.app</string>
</resources>
```

- [ ] **Step 2: Sync Capacitor**

Run: `cd frontend && npx cap sync`

- [ ] **Step 3: Commit Android adjustments**

```bash
git add frontend/android/app/src/main/res/values/strings.xml
git commit -m "chore(mobile): android branding adjustments"
```

---

### Task 5: Automation (GitHub Actions)

**Files:**
- Create: `.github/workflows/android-build.yml`
- Create: `.github/workflows/ios-build.yml`

- [ ] **Step 1: Create Android Build Workflow**

Create `.github/workflows/android-build.yml`:
```yaml
name: Android Build
on:
  push:
    branches: [ main ]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
      - name: Install dependencies
        run: cd frontend && npm install
      - name: Build Web
        run: cd frontend && npm run build
      - name: Capacitor Sync
        run: cd frontend && npx cap sync android
      - name: Build Android APK
        run: cd frontend/android && ./gradlew assembleDebug
      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: app-debug
          path: frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

- [ ] **Step 2: Create iOS Build Workflow**

Create `.github/workflows/ios-build.yml`:
```yaml
name: iOS Build
on:
  push:
    branches: [ main ]
jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: cd frontend && npm install
      - name: Build Web
        run: cd frontend && npm run build
      - name: Capacitor Sync
        run: cd frontend && npx cap sync ios
      - name: Build iOS IPA
        run: |
          cd frontend/ios/App
          xcodebuild -scheme App -archivePath App.xcarchive archive
```

- [ ] **Step 3: Commit Workflows**

```bash
git add .github/workflows/
git commit -m "ci(mobile): add android and ios build workflows"
```
