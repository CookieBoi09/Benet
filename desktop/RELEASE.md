Benet — a place for growing ideas.

Version 1.0.3 automatically centers the box being edited without changing zoom or node positions. Long boxes follow the insertion point; dragging stays manual.

Version 1.0.2 replaces the fixed Properties sidebar with a compact toolbar dropdown. Click Properties to open all existing controls; Escape or an outside click closes it.

Choose **arm64** for Apple Silicon (M1 or newer) or **x64** for Intel Macs. Open the DMG and drag Benet into Applications.

Includes the forest-green workspace, dropdown folder library, freehand smoothed connections, movable nodes, branch deletion, lasso properties, breadth-first quizzes, and Notion Markdown imports. Import and export use native macOS file dialogs. Maps are saved locally in Benet's application data.

**Version 1.0.1 repairs bundle signing.** The app and its nested frameworks are ad-hoc signed, and the build verifies the DMG, signatures, CPU architecture, and launch from the mounted DMG before upload. SHA-256 checksum files accompany each installer.

**This is not Developer ID signed or Apple notarized.** Ad-hoc signing verifies bundle integrity but does not establish an Apple-verified publisher; macOS Gatekeeper may still block a downloaded app. A fully trusted distribution requires an Apple Developer ID certificate and notarization. No system security settings are changed by this installer.

Before switching from the HTML version, use Export to save a JSON backup, then Import it in the desktop app. Existing version-1 JSON libraries are supported. Keep backups when updating or changing computers. Desktop storage is separate from your browser's storage.
