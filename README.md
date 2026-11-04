# Benet

A quiet, browser-based mind mapping and recall workspace. The standalone HTML has no runtime dependencies. Development and desktop packaging require Node.js 22.12+ and `npm ci`. You can open `index.html` directly in a browser; it contains all the JavaScript and CSS and works offline.

```sh
npm ci             # install development and packaging tools
npm run build      # regenerate standalone index.html after editing src/
npm start          # rebuilds and serves on port 3000; PORT overrides it
npm test           # model tests
npm run check      # JavaScript syntax checks
```

## Make a map

Click a blank canvas spot to create a node and type. Move out of the node to trace a freehand connection, then click to create its child. The line follows your cursor with gently rounded corners, limited to 8 canvas units around each turn to preserve the shape. Original points are saved, so smoothing never accumulates on reload. Returning inside the source node resets the unfinished path. New nodes cover older nodes without deleting them. Enter finishes editing; Shift+Enter adds a line. Right-click or Escape pauses connecting. Click an existing node to resume from it. To delete a node, click it and press Delete, even if its text still has focus. You can also lasso several nodes and press Delete. Deleting a parent asks for confirmation before removing it and every descendant; Cancel keeps the entire branch. While typing, Backspace edits text. Outside text editing, Backspace also deletes selected nodes (for Mac keyboards).

Click and drag a box (including its text) to move it in Connect or Move mode. A short click still edits text; dragging pauses drawing so it does not create an accidental child. Connected lines stay attached, and hand-drawn paths bend with the moved endpoint. Use Move to drag the blank canvas, or scroll to pan. Ctrl/Cmd+scroll zooms; the zoom controls and Fit button also work. In Lasso mode, draw around node centers, enter a property, and press +. Remove selected properties clears all properties on the selected nodes. The property dropdown highlights matching nodes.

New map creates a page in the current folder; click its title to rename it. Open the My library dropdown to browse map previews, create nested folders, rename folders, and search. Expand switches the dropdown to a larger grid. The folder button beside the map title moves that map to another folder. Removing a folder moves its contents to its parent without deleting maps. Pages autosave to this browser's local storage, not a cloud account or physical folder. Export creates a JSON backup of all pages and folders. Earlier version-1 backups without folders remain supported. Import adds pages without replacing existing ones. Clearing browser data removes local pages, so keep backups.

## Practice

Choose Everything or a property. Reveal each root, grade it, then recall its children. Hint shows the child count; Reveal shows their text. Grade each revealed idea Yes or No before continuing. Pending branches are processed by original node depth; you may choose another pending branch at the same depth. Leaves are graded on reveal and need no further branch step. Grades last for the quiz session and are cleared on exit or a new quiz.

For a property quiz, only matching nodes participate. Each node connects to its nearest matching ancestor; a node without one becomes a quiz root. Original map depths determine processing order.

## Notion

In Notion, export a page as Markdown, unzip the export if necessary, then import the `.md` file. Headings and nested lists become nodes. Imported Markdown maps are quiz-only. This is an offline import, not a live Notion connection; databases, images, and complex blocks are not preserved. Export Markdown pages individually to import multiple pages. No credentials are required.

## macOS desktop app (.dmg)

Download the Apple Silicon (`arm64`) or Intel (`x64`) DMG from [GitHub Releases](https://github.com/CookieBoi09/Benet/releases) once the macOS workflow has completed. Drag Benet into Applications. The Electron desktop app includes native open/save dialogs, menu shortcuts, persistent local storage, and all web editor and quiz features. It runs offline.

**The initial build is unsigned and unnotarized.** Apple signing credentials are not configured. macOS may block opening it by default. Desktop app storage is separate from browser storage: export your library from the HTML version, then import it in the desktop app. Keep backups before updating. Existing browser storage keys and JSON format remain compatible.

```sh
npx install-electron # download the development Electron runtime
npm run desktop     # open the desktop app from source
npm run dist:mac     # build DMGs on a Mac (Apple Silicon and Intel)
npm run test:desktop # exercise native bridge and persistence
```

A `v*` tag builds both DMGs on GitHub Actions and publishes them as GitHub Release downloads. You can also run **Build macOS app** manually from Actions and download build artifacts. A Linux workspace can validate the Electron app but cannot generate or test a macOS DMG natively. Updating the app does not delete its user profile; moving to another computer requires exporting/importing a backup. There is no cloud sync or automatic update mechanism.

## Validation

The model suite covers breadth-first ordering, property scope, polygon selection, and Markdown hierarchy. Browser smoke validation additionally exercised complete quizzes and self-grading, creating connected nodes, lasso tagging, property quizzes, persistence after reload, and read-only Notion import using Chromium.

`npm run test:browser` runs the complete regression flow using Chromium (set `BROWSER_EXECUTABLE` if needed), including folder operations, old/new backup imports, both quiz modes, drawing, lasso, deletion, dragging, and mobile layout. Screenshots are saved to ignored `artifacts/`. `npm run test:desktop` tests the real Electron renderer and IPC, using simulated native file choices and an isolated temporary user profile.
