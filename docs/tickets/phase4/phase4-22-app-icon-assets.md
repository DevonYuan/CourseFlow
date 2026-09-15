# Ticket: phase4-22-app-icon-assets

## Title
**App Icons & Branding**

## Description
Generate icon sets: Windows `.ico` (256, 128, 64, 32, 16), macOS `.icns` (512–16), Linux PNG (512, 256, 128). Splash screen / DMG background.

## Acceptance Criteria
- [ ] Source icon: SVG master (vector, scalable)
- [ ] Windows: `build/icon.ico` with 256, 128, 64, 32, 16px
- [ ] macOS: `build/icon.icns` with 512, 256, 128, 64, 32, 16px
- [ ] Linux: `build/icons/` PNG set (512, 256, 128, 64, 32, 16)
- [ ] DMG background: `build/dmg-background.png` (540x380)
- [ ] Icons follow CourseFlow brand (teal accent, clean design)
- [ ] Icons work at small sizes (16px readable)
- [ ] Added to git (build/ folder)

## Technical Details

### Source Design
- Master file: `design/icon-master.svg` (or Figma)
- Brand colors: Teal primary (`#14b8a6`), dark surface (`#1e2220`), light surface (`#fbfaf6`)
- Simple, recognizable at 16px: Calendar/checkmark abstraction

### Generation Tools
```bash
# Option 1: Iconutil (macOS) + ImageMagick
# Option 2: electron-icon-builder (npm)
# Option 3: Online converter + manual assembly

# Recommended: electron-icon-builder
pnpm add -D electron-icon-builder
npx electron-icon-builder --input=design/icon-master.png --output=build
```

### Windows .ico
```bash
# Using ImageMagick
magick convert design/icon-master.png \
  -define icon:auto-resize=256,128,64,32,16 \
  build/icon.ico
```

### macOS .icns
```bash
# Using iconutil (macOS only)
mkdir build/icon.iconset
for size in 16 32 64 128 256 512; do
  sips -z $size $size design/icon-master.png --out build/icon.iconset/icon_${size}x${size}.png
  sips -z $((size*2)) $((size*2)) design/icon-master.png --out build/icon.iconset/icon_${size}x${size}@2x.png
done
iconutil -c icns build/icon.iconset -o build/icon.icns
```

### Linux PNG Set
```bash
mkdir -p build/icons
for size in 16 32 64 128 256 512; do
  magick convert design/icon-master.png -resize ${size}x${size} build/icons/${size}x${size}.png
done
```

### DMG Background
- Dimensions: 540x380 (matching dmg.window in electron-builder.yml)
- Design: Subtle gradient with CourseFlow logo, arrow to Applications folder
- File: `build/dmg-background.png`

### Git Integration
- Add `build/` to `.gitignore`? **No** — commit generated icons for reproducible builds
- Or: Generate in CI (but needs design files)
- **Recommendation:** Commit generated icons, keep source SVG in `design/`

## Dependencies
- Requires: Design assets (icon master)
- Requires: `phase4-18-electron-builder` (references icon paths)

## Testing
- Visual inspect: All sizes look correct
- Windows: Install → check taskbar/start menu icon
- macOS: Install → check Dock/Applications icon
- Linux: Install → check app launcher icon
- DMG: Mount → check background renders correctly

## Related
- `phase4-18-electron-builder` — Uses icons
- `phase4-23-native-menus` — Menu bar icon (macOS)