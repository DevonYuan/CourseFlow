# Ticket: phase4-18-electron-builder

## Title
**electron-builder Config**

## Description
Configure `electron-builder` in `package.json` / `electron-builder.yml`. Targets: `nsis` (Windows), `dmg` (macOS), `AppImage` (Linux). App ID, product name, copyright, icons.

## Acceptance Criteria
- [ ] `electron-builder` installed as dev dependency
- [ ] Config file: `electron-builder.yml` (or `package.json` `build` section)
- [ ] Targets configured:
  - Windows: `nsis` (per-user install, optional per-machine)
  - macOS: `dmg` + `zip` (for auto-updater)
  - Linux: `AppImage` + `deb` + `rpm`
- [ ] App metadata: `appId`, `productName`, `copyright`, `version` (from package.json)
- [ ] Icons: `build/icon.ico`, `build/icon.icns`, `build/icons/png/512x512.png` etc.
- [ ] Extra files: migrations, preload, main bundle included
- [ ] `pnpm build` produces installers in `dist/`
- [ ] Installers install and run on target platforms

## Technical Details

### Install Dependencies
```bash
pnpm add -D electron-builder
pnpm add electron-updater  # for ticket 4.19
```

### electron-builder.yml
```yaml
appId: com.courseflow.app
productName: CourseFlow
copyright: Copyright © 2026 CourseFlow Authors
version: ${version}  # from package.json

directories:
  output: dist
  buildResources: build

files:
  - dist/**/*
  - package.json
  - '!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}'
  - '!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}'
  - '!**/node_modules/*.d.ts'
  - '!**/node_modules/.bin'
  - '!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}'
  - '!**/node_modules/**/src'
  - '!**/node_modules/**/test*'
  - '!**/node_modules/**/*.md'

extraResources:
  - from: src/backend/main/db/migrations
    to: migrations
    filter: ['*.sql']

# Windows
win:
  target: nsis
  icon: build/icon.ico
  publisherName: CourseFlow
  verifyUpdateCodeSignature: false  # set true when code signing (ticket 4.20)

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  perMachine: false  # per-user by default
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: CourseFlow
  uninstallDisplayName: CourseFlow
  license: LICENSE
  installerIcon: build/icon.ico
  uninstallerIcon: build/icon.ico
  installerHeaderIcon: build/icon.ico

# macOS
mac:
  target:
    - target: dmg
      arch: [x64, arm64]
    - target: zip
      arch: [x64, arm64]
  icon: build/icon.icns
  category: public.app-category.productivity
  hardenedRuntime: true
  gatekeeperAssess: false  # set true when notarized
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  darkModeSupport: true

dmg:
  contents:
    - x: 130
      y: 220
      type: link
      path: /Applications
    - x: 410
      y: 220
      type: file
  window:
    width: 540
    height: 380
  icon: build/icon.icns
  background: build/dmg-background.png

# Linux
linux:
  target:
    - AppImage
    - deb
    - rpm
  icon: build/icons
  category: Office
  maintainer: CourseFlow Team <team@courseflow.app>
  description: A desktop homework tracker for students
  synapse: false

appImage:
  runtime: fuse3  # or fuse2

# Publish (for auto-updater)
publish:
  provider: github
  owner: courseflow
  repo: courseflow
  releaseType: release
```

### package.json Scripts
```json
{
  "scripts": {
    "build": "electron-vite build && electron-builder",
    "build:win": "electron-vite build && electron-builder --win",
    "build:mac": "electron-vite build && electron-builder --mac",
    "build:linux": "electron-vite build && electron-builder --linux",
    "dist": "electron-builder --publish=always"
  }
}
```

### Build Resources Structure
```
build/
  icon.ico           # Windows (256, 128, 64, 32, 16)
  icon.icns          # macOS (512-16)
  icons/             # Linux PNG set
    512x512.png
    256x256.png
    128x128.png
    64x64.png
    32x32.png
    16x16.png
  entitlements.mac.plist
  dmg-background.png (optional)
```

### electron-vite.config.ts Integration
- Ensure `electron-vite build` outputs to `dist/` matching `files` config
- Main entry: `dist/backend/main/index.js`
- Preload: `dist/backend/preload/index.js`
- Renderer: `dist/frontend/`

## Dependencies
- Requires: `pnpm add -D electron-builder`
- Requires: App icons (ticket 4.22)

## Testing
- Run `pnpm build` → verify `dist/` contains installers
- Test Windows NSIS installer (VM or CI)
- Test macOS DMG (VM or CI)
- Test Linux AppImage (CI)
- Verify app launches and works after install

## Related
- `phase4-19-auto-updater` — Uses same publish config
- `phase4-20-code-signing` — Adds signing config
- `phase4-22-app-icon-assets` — Provides icons