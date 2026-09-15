# Ticket: phase4-21-ci-release

## Title
**CI Release Pipeline**

## Description
GitHub Actions workflow: `release.yml` on tag push. Run typecheck, lint, test, build, sign, notarize, upload artifacts to GitHub Release. Generate changelog from conventional commits.

## Acceptance Criteria
- [ ] Workflow: `.github/workflows/release.yml`
- [ ] Triggers: Push tag matching `v*` (e.g., `v0.4.0`)
- [ ] Jobs:
  - `typecheck-lint-test` (Ubuntu): typecheck, lint, unit tests
  - `build-windows` (Windows): build, sign, upload
  - `build-macos` (macOS): build, sign, notarize, upload
  - `build-linux` (Ubuntu): build, GPG sign, upload
  - `release` (Ubuntu): Create GitHub Release with artifacts + changelog
- [ ] Matrix strategy for multi-platform builds
- [ ] Changelog generated from conventional commits (`feat:`, `fix:`, `chore:`)
- [ ] Artifacts: `.exe`, `.dmg`, `.AppImage`, `.deb`, `.rpm`, `.blockmap`, `.sig`
- [ ] Release notes include: version, date, changelog, install instructions
- [ ] Draft release created (manual publish) or auto-publish
- [ ] Failure notifications (Slack/email)

## Technical Details

### Workflow File (.github/workflows/release.yml)
```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write  # For creating releases
  packages: read

env:
  NODE_VERSION: '24'
  PNPM_VERSION: '9'

jobs:
  typecheck-lint-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test -- --pool=forks --poolOptions.forks.singleFork
  
  build-windows:
    needs: typecheck-lint-test
    runs-on: windows-latest
    env:
      CSC_LINK: ${{ secrets.CSC_LINK }}
      CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build:win
      - uses: actions/upload-artifact@v4
        with:
          name: windows-installer
          path: dist/*.exe
          retention-days: 30
  
  build-macos:
    needs: typecheck-lint-test
    runs-on: macos-latest
    env:
      CSC_LINK: ${{ secrets.CSC_LINK }}
      CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
      APPLE_ID: ${{ secrets.APPLE_ID }}
      APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
      APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build:mac
      - uses: actions/upload-artifact@v4
        with:
          name: macos-installer
          path: dist/*.dmg
          retention-days: 30
      - uses: actions/upload-artifact@v4
        with:
          name: macos-zip
          path: dist/*.zip
          retention-days: 30
  
  build-linux:
    needs: typecheck-lint-test
    runs-on: ubuntu-latest
    env:
      GPG_PRIVATE_KEY: ${{ secrets.GPG_PRIVATE_KEY }}
      GPG_PASSPHRASE: ${{ secrets.GPG_PASSPHRASE }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build:linux
      - uses: actions/upload-artifact@v4
        with:
          name: linux-installers
          path: |
            dist/*.AppImage
            dist/*.deb
            dist/*.rpm
          retention-days: 30
  
  release:
    needs: [build-windows, build-macos, build-linux]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          pattern: *-installer*
          path: dist/
          merge-multiple: true
      
      - name: Generate Changelog
        id: changelog
        run: |
          # Extract commits since last tag
          LAST_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
          if [ -n "$LAST_TAG" ]; then
            COMMITS=$(git log $LAST_TAG..HEAD --pretty=format:"- %s (%h)" --reverse)
          else
            COMMITS=$(git log --pretty=format:"- %s (%h)" --reverse)
          fi
          
          # Categorize
          FEATURES=$(echo "$COMMITS" | grep "^\- feat:" | sed 's/^- feat: /* /')
          FIXES=$(echo "$COMMITS" | grep "^\- fix:" | sed 's/^- fix: /* /')
          OTHER=$(echo "$COMMITS" | grep -v "^\- feat:" | grep -v "^\- fix:" | sed 's/^- /* /')
          
          cat > changelog.md << EOF
          # CourseFlow ${{ github.ref_name }}
          
          ${FEATURES:+### Features\n$FEATURES\n}
          ${FIXES:+### Fixes\n$FIXES\n}
          ${OTHER:+### Other\n$OTHER\n}
          
          **Full Changelog**: https://github.com/courseflow/courseflow/compare/${LAST_TAG}...${{ github.ref_name }}
          EOF
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          tag_name: ${{ github.ref_name }}
          name: CourseFlow ${{ github.ref_name }}
          body_path: changelog.md
          draft: true  # Set false for auto-publish
          prerelease: ${{ contains(github.ref_name, '-') }}
          files: |
            dist/*.exe
            dist/*.dmg
            dist/*.zip
            dist/*.AppImage
            dist/*.deb
            dist/*.rpm
            dist/*.blockmap
            dist/*.sig
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Changelog Generation
- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`
- Categories: Features, Fixes, Other
- Link to GitHub compare view

### Version Bumping
- Manual: `pnpm version patch|minor|major` → creates tag + pushes
- Or: `npm version` in CI before release job

## Dependencies
- Requires: `phase4-18-electron-builder` (build scripts)
- Requires: `phase4-20-code-signing` (signing in CI)
- Requires: GitHub repository with Actions enabled
- Requires: Secrets configured (ticket 4.20)

## Testing
- Push test tag `v0.4.0-test` → verify workflow runs
- Verify all 3 platform builds complete
- Verify GitHub Release created with correct artifacts
- Verify changelog format
- Verify draft release (not published until manual approval)

## Related
- `phase4-18-electron-builder` — Build config
- `phase4-20-code-signing` — Signing
- `phase4-19-auto-updater` — Release feed for auto-updater