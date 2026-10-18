# Manual verification log

**Date:** 2026-10-18  
**Environment:** Ubuntu 26.04.1 LTS, GNOME/Wayland session, Node 22.22.1, Rust 1.99.1.  
**Displays:** the real session uses `:0`; UI interaction tests used private Xvfb displays `:101`–`:105` at 1100×760 with software rendering, because the app was launched and driven headlessly.

## Automated checks

| Check | Command | Result |
| --- | --- | --- |
| Rust unit tests | `cd src-tauri && source ~/.cargo/env && cargo test` | 37 passed |
| Rust lints | `cargo clippy -- -D warnings` | clean |
| TypeScript | `npm run typecheck` | clean |
| Frontend tests | `npm run test` | 38 passed in 9 files |
| Frontend production build | `npm run build` | built successfully |
| Tauri bundles | `npm run tauri build -- --bundles deb,appimage` | `.deb` and AppImage generated |

Rust tests cover serialization, atomic writes, corrupt-catalog recovery, path validation, duplicate paths, cover staging/promotion/removal, action argument construction, and autostart preference logic. Frontend tests cover the catalog hook, active grid and ordering, empty state, archived view, create/edit form, action menu, settings toggle, and integration flows.

## UI checks

The app was run against a seeded catalog with three covered projects, one project without a cover, and one archived project.

1. **Home window:** compact 960×640 window, responsive grid, covers, initials placeholder, truncated paths, archived counter. Evidence: `docs/screenshots/home.png`.
2. **Create project:** opened **Nuevo proyecto**, entered `Demo UI Project` without a path, saved. The modal closed, the project appeared first in the grid with `Sin ruta`, and the toast `Proyecto creado.` appeared. The project survived a later app restart. Evidence: `docs/screenshots/new-project.png`.
3. **Edit project:** opened the card menu → **Editar**, changed the name and set `/tmp/opencode` as the path. Save showed `Proyecto actualizado.` and the card moved to the front. Evidence: `docs/screenshots/action-menu.png`.
4. **Duplicate path validation:** setting the path to an existing project folder returned the Spanish `DUPLICATE_PATH` message and named the project that already used it. The catalog was not modified.
5. **Cover editing:** selected `/tmp/opencode/pv-demo/covers/cover-3.png` through the native GTK file dialog. The modal preview showed the image, save promoted it to `covers/<project-id>-<timestamp>-<suffix>.png` in the app data directory, and the card displayed it. The previous placeholder disappeared.
6. **Action menu states:** a project without a path showed all three opening actions disabled with the explanation `Asigna una ruta local para abrir este proyecto.` A project with a path showed them enabled. Evidence: `docs/screenshots/action-menu.png`.
7. **Archive/restore/delete:** `Cerrar proyecto` removed the card from the grid, incremented the archived count, and showed `Proyecto cerrado. Puedes restaurarlo desde Archivados.` The archived view listed it; **Restaurar** returned it to the grid. Deleting another archived project opened a confirmation dialog, canceled safely once, and then removed the entry with `Proyecto eliminado.` Evidence: `docs/screenshots/archived.png`.
8. **Keyboard/focus:** the action menu focused its first enabled item and supported ArrowUp/ArrowDown, Home, End, Escape, and outside-click close. The modal canceled with Escape and returned focus. These are covered by component tests; the native `<dialog>` behavior was exercised in the same Xvfb run.

## Desktop actions

The app's real `open_project_action` command was exercised through the UI with a temporary `PATH` containing logging shims for `xdg-open`, `code`, and `x-terminal-emulator`. The log recorded:

```text
xdg-open argc=1 arg1=/tmp/opencode
code argc=1 arg1=/tmp/opencode
x-terminal-emulator argc=1 arg1=--working-directory=/tmp/opencode
```

A second run used a path containing spaces and a semicolon (`/tmp/opencode/My Project; test`) against the installed `.deb`:

```text
xdg-open argc=1 arg1=/tmp/opencode/My Project; test
x-terminal-emulator argc=1 arg1=--working-directory=/tmp/opencode/My Project; test
```

This confirms that the selected path is passed as a single argument, no shell is involved, and all three action types are wired through the Tauri command. The shims were used instead of opening native file-manager/editor/terminal windows on the physical desktop so the user's session was not disturbed. Tool availability detection was verified against the real `PATH` (`xdg-open`, `code`, and `x-terminal-emulator` are installed). The VS Code action uses the same `code <path>` single-argument construction and is covered by the Rust action tests.

## Single instance

With the app already running on `:102`, a second `/usr/bin/project-viewer --autostart` process exited with code 0, left exactly one `Project Viewer` window, and left one application process. The same check passed for the packaged `.deb` on `:103`.

## Autostart

1. First launch of the installed `.deb` created `~/.config/autostart/Project Viewer.desktop` and wrote `settings.json` with `autostartInitialized: true` and `autostartEnabled: true`.
2. `desktop-file-validate "$HOME/.config/autostart/Project Viewer.desktop"` reported no errors.
3. The settings gear showed **Iniciar al iniciar sesión** checked. Unchecking it removed the entry and persisted `autostartEnabled: false`; re-checking recreated the entry and persisted `true`. Evidence: `docs/screenshots/settings.png`.
4. Launching `/usr/bin/project-viewer --autostart` after closing the app opened the window and showed the catalog.
5. The AppImage was run from a path containing spaces. The generated entry initially exposed a defect: `Exec` was unquoted. The backend now rewrites the `Exec` line with a quoted executable path. After the fix:

   ```ini
   Exec="/home/ian/Documents/remote/github/Project-Viewer/src-tauri/target/release/bundle/appimage/Project Viewer_0.1.0_amd64.AppImage" --autostart
   ```

   `desktop-file-validate` accepts it, and the entry points to the real AppImage path rather than the `/tmp/.mount_*` runtime path.

## Corrupt catalog recovery

`projects.json` was replaced with invalid JSON and the installed app was started. The app showed the empty state plus `Se recuperó el catálogo desde un respaldo.`, renamed the bad file to `projects.corrupt-1792359944935.json`, and remained usable. After the test the demo catalog and covers were removed so the installed app starts empty for the user.

## Packaging

- `.deb`: `src-tauri/target/release/bundle/deb/Project Viewer_0.1.0_amd64.deb` (2.46 MiB). Installed with `apt`, runs as `/usr/bin/project-viewer`.
- AppImage: `src-tauri/target/release/bundle/appimage/Project Viewer_0.1.0_amd64.AppImage` (84.17 MiB). Runs on Xvfb, updates autostart, and is self-contained apart from the system WebKitGTK/GTK runtime.
- The `.deb` declares `libwebkit2gtk-4.1-0` and `libgtk-3-0`; the build host also required the `-dev` headers listed in the README.

## Launcher configuration revision (2026-10-18)

The group 7 changes were exercised in a debug build with an isolated data directory (`PROJECT_VIEWER_DATA_DIR=/tmp/opencode/pv-launcher-demo`) and logging shims on `PATH` for `code`, `godot`, `gnome-terminal`, and `xdg-open`.

1. **Global defaults:** opened Ajustes → Lanzadores, changed the editor from `Automático` to `Godot`, saved. The settings file persisted:
   `"defaultEditor": { "kind": "godot" }`, and the toast `Lanzadores actualizados.` appeared.
2. **Inheritance:** created `Launcher Demo` with path `/tmp/opencode`, leaving editor/terminal on `Heredar`. The project JSON had no `editor`/`terminal` fields and the menu showed `Abrir en Godot` and `Abrir terminal (GNOME Terminal)`.
3. **Godot execution:** clicking `Abrir en Godot` produced:
   ```text
   godot argc=3 [--editor] [--path] [/tmp/opencode]
   ```
4. **Terminal bug fix:** clicking `Abrir terminal (GNOME Terminal)` produced:
   ```text
   gnome-terminal argc=1 [--working-directory=/tmp/opencode]
   ```
   This is the key regression: the wrapper `x-terminal-emulator` is no longer selected and the terminal receives the project directory.
5. **Per-project override:** edited the project, changed its editor to VS Code, saved. The project JSON stored `"editor": { "kind": "vscode" }`, the menu changed to `Abrir en VS Code`, and clicking it produced `code argc=1 [/tmp/opencode]`.
6. **Custom command validation:** frontend tests reject commands without `{path}`; Rust tests cover quoted arguments, spaces, metacharacters, empty templates, and unterminated quotes.
7. **Settings/UI tests:** 38 frontend tests cover global settings, per-project overrides, dynamic labels, unavailable tools, and form validation.
8. **Packaged binary:** the installed `.deb` was run with a temporary project (`editor: godot` override) and the same shims. It produced `gnome-terminal --working-directory=/tmp/opencode` and `godot --editor --path /tmp/opencode`; the temporary catalog was removed afterward.

## Known limitations / notes

- GTK printed `Gtk-CRITICAL` warnings while the file chooser ran under Xvfb without a window manager; the file selection still worked. This environment-specific noise was not observed in the packaged app's normal window.
- Native file-manager, terminal, and VS Code windows were not opened on the physical `:0` desktop during automation to avoid disturbing the user's session. Their command paths are covered by the shim test above and by `cargo test`; a final click-through on the real desktop is recommended when convenient.
- AppImage autostart is only valid while the AppImage remains at the path where it was launched. Moving it requires launching it again so the entry is refreshed.
- Linux only; Windows/macOS support is intentionally out of scope for this change.
