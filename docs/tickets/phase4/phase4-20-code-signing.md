# Ticket: phase4-20-code-signing

## Title
**Code Signing & Notarization Prep**

## Description
Windows: Authenticode cert (EV or standard). macOS: Developer ID + notarization (`notarytool`). Linux: GPG sign AppImage. CI secrets configuration.

## Acceptance Criteria
- [ ] Windows: Code signing with Authenticode certificate (EV preferred)
- [ ] macOS: Code signing with Developer ID Application + Notarization via `notarytool`
- [ ] Linux: GPG signing of AppImage
- [ ] CI secrets configured (GitHub Actions secrets for certs, passwords, Apple ID, Team ID)
- [ ] `electron-builder` config updated for signing
- [ ] Build pipeline signs artifacts automatically
- [ ] Signed installers pass verification on target OS
- [ ] Documentation for certificate renewal process

## Technical Details

### Windows Code Signing
```yaml
# electron-builder.yml
win:
  certificateFile: ${env.CSC_LINK}  # Base64 encoded .pfx
  certificatePassword: ${env.CSC_KEY_PASSWORD}
  # For EV cert (hardware token):
  # certificateSubjectName: "CourseFlow Inc."
  # rfc3161TimeStampServer: "http://timestamp.digicert.com"
```

**Certificate Options:**
- Standard Authenticode: Software-based, cheaper, shows "Verified Publisher" after reputation
- EV Authenticode: Hardware token, immediate SmartScreen reputation, more expensive
- **Recommendation:** Start with standard, upgrade to EV if budget allows

### macOS Code Signing + Notarization
```yaml
# electron-builder.yml
mac:
  identity: "Developer ID Application: CourseFlow Inc. (TEAM_ID)"
  hardenedRuntime: true
  gatekeeperAssess: true
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist

# Notarization
afterSign: notarize.js
```

**notarize.js (electron-builder hook):**
```javascript
// notarize.js
import { notarize } from '@electron/notarize';

export default async function notarizeHook(context) {
  const { appOutDir, packager } = context;
  const appName = packager.appInfo.productFilename;
  
  if (process.platform !== 'darwin') return;
  
  await notarize({
    tool: 'notarytool',
    appBundleId: 'com.courseflow.app',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
}
```

**entitlements.mac.plist:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key><true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
  <key>com.apple.security.cs.disable-library-validation</key><true/>
  <key>com.apple.security.automation.apple-events</key><true/>
</dict>
</plist>
```

### Linux GPG Signing
```yaml
# electron-builder.yml
linux:
  target:
    - AppImage
    - deb
    - rpm
  gpgKey: ${env.GPG_KEY_ID}  # Key ID for signing
```

**GPG Setup:**
```bash
# Generate key (if needed)
gpg --full-generate-key
# Export public key for users to verify
gpg --armor --export YOUR_KEY_ID > courseflow.gpg.key
```

### CI Secrets (GitHub Actions)
| Secret | Description | Platform |
|--------|-------------|----------|
| `CSC_LINK` | Base64 encoded .pfx certificate | Windows |
| `CSC_KEY_PASSWORD` | Certificate password | Windows |
| `APPLE_ID` | Apple Developer ID email | macOS |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for notarytool | macOS |
| `APPLE_TEAM_ID` | Apple Developer Team ID | macOS |
| `GPG_PRIVATE_KEY` | Base64 encoded private key | Linux |
| `GPG_KEY_ID` | Key ID for signing | Linux |
| `GPG_PASSPHRASE` | Passphrase for GPG key | Linux |

### Electron-Builder Env Variables
```bash
# Windows
CSC_LINK="base64_pfx"
CSC_KEY_PASSWORD="password"

# macOS
APPLE_ID="dev@example.com"
APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
APPLE_TEAM_ID="ABCDE12345"

# Linux
GPG_PRIVATE_KEY="base64_private_key"
GPG_PASSPHRASE="passphrase"
```

## Dependencies
- Requires: `phase4-18-electron-builder` (base config)
- Requires: Certificates purchased/obtained
- Requires: Apple Developer Program enrollment ($99/yr)
- Requires: `pnpm add -D @electron/notarize`

## Testing
- Windows: Install signed .exe → Verify "Verified Publisher" in properties
- macOS: `spctl -a -v CourseFlow.app` → "accepted"
- macOS: `xcrun notarytool log` → Check notarization status
- Linux: `gpg --verify CourseFlow.AppImage.sig` → Good signature
- CI: Run build pipeline → Artifacts signed

## Related
- `phase4-18-electron-builder` — Base config
- `phase4-19-auto-updater` — Requires signed updates
- `phase4-21-ci-release` — CI pipeline with signing