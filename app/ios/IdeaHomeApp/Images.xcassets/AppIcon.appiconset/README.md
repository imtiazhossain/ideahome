# App Icon

Production builds require a full set of app icons.

**Required for App Store:** one 1024×1024 px PNG (no transparency, no rounded corners). Add it in Xcode: open this asset catalog → AppIcon → provide the 1024 image; Xcode can generate the other sizes.

Sizes referenced in `Contents.json`: 20pt, 29pt, 40pt, 60pt (each @2x and @3x), plus 1024pt for App Store. See **app/docs/ios-production.md** for details.
