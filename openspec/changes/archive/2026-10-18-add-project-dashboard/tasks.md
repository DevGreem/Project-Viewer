# Tasks

## 1. Setup y andamiaje

- [x] 1.1 Instalar las dependencias del sistema con `apt` (`libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `build-essential`) y verificar con `pkg-config --modversion webkit2gtk-4.1` y `pkg-config --modversion javascriptcoregtk-4.1` que devuelven versión.
- [x] 1.2 Verificar el toolchain con `source ~/.cargo/env && rustc --version && cargo --version` y `node --version && npm --version`; dejar documentado en el README que Rust vive en `~/.cargo/bin` y cómo cargarlo en shells no interactivos.
- [x] 1.3 Generar el esqueleto Tauri 2 + React 19 + TypeScript + Vite en la raíz del repo, con identificador `com.ian.projectviewer`, nombre `Project Viewer`, ventana 960×640 (mínimo 720×480) y `productName` correcto; verificar que `npm run tauri dev` abre una ventana vacía con el título esperado.
- [x] 1.4 Añadir `.gitignore` para `node_modules/`, `dist/`, `src-tauri/target/` y datos locales; configurar TypeScript estricto, scripts `dev`, `build`, `typecheck`, `test` y `tauri`, y Vitest + Testing Library + jsdom con polyfill de `<dialog>`; verificar que `npm run typecheck` y `npm run test` pasan con una prueba de humo.
- [x] 1.5 Actualizar el README con requisitos, comandos de desarrollo/build, ubicación de datos y alcance Linux inicial; verificar que cada comando documentado se ejecuta tal cual.

## 2. Catálogo y persistencia (Rust)

- [x] 2.1 Implementar los tipos `CatalogFile`, `Project` y `ProjectStatus` con fechas epoch, `version` y serialización serde; verificar con tests de round-trip y compatibilidad del JSON de ejemplo del design.
- [x] 2.2 Implementar `CatalogStore` con carga desde `app_data_dir/projects.json`, escritura atómica (`tmp` → `fsync` → `rename`) y `Mutex` en el estado de Tauri; verificar con tests que una escritura fallida no destruye el archivo anterior y que los datos sobreviven a recargar.
- [x] 2.3 Implementar la recuperación ante JSON corrupto: renombrar a `projects.corrupt-<epoch>.json`, arrancar con catálogo vacío y devolver un aviso; verificar con un test que el respaldo existe y la app sigue operativa.
- [x] 2.4 Implementar validación de nombre (1–80 caracteres, recortado), ruta absoluta existente y directorio, canonicalización y unicidad entre proyectos activos; verificar con tests de ruta relativa, inexistente, archivo, duplicado activo y ruta reutilizada desde archivados.
- [x] 2.5 Implementar las operaciones de alta, edición, cierre, restauración y eliminación con UUID y timestamps; verificar con tests que cada operación devuelve el catálogo actualizado y que eliminar no toca la carpeta local.
- [x] 2.6 Implementar el pipeline de portadas: staging en `covers/staged-<uuid>.<ext>`, validación por bytes mágicos PNG/JPEG/WebP/GIF, límite de 5 MB, renombrado a `<uuid>-<timestamp>.<ext>`, borrado de la anterior y limpieza de staged huérfanos; verificar con tests de formato válido, SVG, archivo falso, exceso de tamaño y reemplazo.
- [x] 2.7 Implementar el contrato de errores tipados con códigos estables (`INVALID_NAME`, `INVALID_PATH`, `DUPLICATE_PATH`, `COVER_UNSUPPORTED`, `COVER_TOO_LARGE`, `CATALOG_READ_FAILED`, `TOOL_NOT_FOUND`, `SPAWN_FAILED`, `AUTOSTART_FAILED`) y su serialización; verificar con tests de serde que cada error conserva código y mensaje.
- [x] 2.8 Documentar en `docs/catalog.md` el formato JSON, la ubicación de datos, la recuperación y el contrato de errores; verificar que el documento coincide con el modelo y los tests implementados.

## 3. Ventana y experiencia de proyectos (React)

- [x] 3.1 Crear los tipos TypeScript del catálogo, el cliente de comandos Tauri y el hook `useCatalog` con estados de carga, error y reintento; verificar con tests que el hook carga, muestra error y reintenta.
- [x] 3.2 Implementar cabecera, grilla responsive, tarjetas con portada/placeholder, nombre y ruta truncada, y orden por `updatedAt` descendente; verificar con tests de solo activos, orden tras edición y adaptación de columnas.
- [x] 3.3 Implementar el estado vacío y la vista de archivados con contador, restauración y eliminación con confirmación; verificar con tests de catálogo vacío, todos archivados, restaurar y cancelar eliminación.
- [x] 3.4 Implementar el formulario modal de alta/edición con nombre, selector de ruta, selector de portada con vista previa, validaciones y acciones guardar/cancelar; verificar con tests de creación, edición precargada, nombre vacío, ruta inválida y cancelación con Escape.
- [x] 3.5 Implementar el menú de tarjeta con "Editar" y "Cerrar proyecto", cierre por Escape/clic fuera, foco al primer elemento y toasts de error/confirmación; verificar con tests de apertura, cierre y cierre de proyecto.
- [x] 3.6 Completar la accesibilidad: navegación con Tab, activación con Enter/Espacio, foco atrapado en modales y retorno al disparador; verificar con tests de teclado y foco.
- [x] 3.7 Añadir al README una sección de uso (crear, editar, archivar, restaurar, eliminar) y la ubicación de datos; verificar que los pasos descritos coinciden con la UI entregada.

## 4. Acciones de apertura

- [x] 4.1 Implementar la detección de herramientas (`xdg-open`, `code`, terminales candidatas) y el mapa de argumentos de terminal por herramienta; verificar con tests usando un `PATH` de prueba para herramientas presentes y ausentes.
- [x] 4.2 Implementar el comando `open_project_action` con acciones restringidas, revalidación de ruta existente/directorio, paso de la ruta como argumento único y errores `PATH_UNAVAILABLE`/`SPAWN_FAILED`; verificar con tests de ruta borrada, acción inválida y ruta con espacios/caracteres especiales.
- [x] 4.3 Conectar el menú con `get_action_availability`, deshabilitar acciones sin ruta o sin herramienta con explicación, y mostrar toasts ante fallos; verificar con tests de disponibilidad, proyecto sin ruta y error de lanzamiento.
- [x] 4.4 Probar manualmente en GNOME la apertura real de carpeta, VS Code y terminal, incluida una ruta con espacios; registrar el resultado en `docs/manual-tests.md` con fecha y entorno.
- [x] 4.5 Documentar en el README las acciones disponibles, la detección de herramientas y qué hacer si VS Code o la terminal no aparecen; verificar que las instrucciones coinciden con `docs/manual-tests.md`.

## 5. Autostart e instancia única

- [x] 5.1 Integrar `tauri-plugin-single-instance` antes del resto de plugins y hacer que el segundo lanzamiento muestre/enfoque la ventana existente; verificar manualmente ejecutando dos instancias y comprobando que queda una sola ventana.
- [x] 5.2 Integrar `tauri-plugin-autostart`, implementar `settings.json` con `autostartInitialized`/`autostartEnabled`, habilitar por defecto en la primera ejecución empaquetada, refrescar la ruta en cada arranque y exponer `get_autostart_enabled`/`set_autostart_enabled`; verificar con tests de la lógica de settings y con una build empaquetada.
- [x] 5.3 Añadir el control de autostart en el menú de ajustes con estado real, persistencia y mensaje explicativo en modo desarrollo; verificar con tests de toggle y con la entrada XDG creada/eliminada.
- [x] 5.4 Verificar manualmente la entrada `~/.config/autostart/*.desktop` con `desktop-file-validate`, el arranque con `--autostart` y el ciclo deshabilitar/habilitar; registrar el resultado en `docs/manual-tests.md`.
- [x] 5.5 Documentar en el README el comportamiento del autostart, cómo desactivarlo y la diferencia entre build empaquetada y modo desarrollo; verificar que los pasos funcionan en la build instalada.

## 6. Empaquetado y verificación de integración

- [x] 6.1 Configurar los targets `deb` y `appimage`, iconos y metadatos del bundle; ejecutar `npm run tauri build -- --bundles deb,appimage` y verificar que se generan ambos artefactos.
- [x] 6.2 Instalar el `.deb`, abrir la app y verificar la ventana, el directorio de datos y la entrada de autostart; comprobar que `desktop-file-validate` no reporta errores.
- [x] 6.3 Ejecutar el AppImage y verificar que arranca y que el autostart apunta al AppImage real, no a una ruta temporal de montaje.
- [x] 6.4 Recorrer la aceptación manual completa (crear/editar portada y ruta, reiniciar, archivar/restaurar/eliminar, abrir carpeta/VS Code/terminal, corromper el JSON y recuperar) y registrar evidencia en `docs/manual-tests.md`.
- [x] 6.5 Ejecutar la suite completa: `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`, `npm run typecheck`, `npm run test` y `npm run build`; verificar que todo pasa sin errores.
- [x] 6.6 Revisar el README final (requisitos, uso, datos, acciones, autostart, build, alcance Linux y trabajo futuro multiplataforma) y verificar que no quedan instrucciones desactualizadas.

## 7. Lanzadores configurables y corrección de terminal

Esta sección revisa el comportamiento implementado en el grupo 4. Las tareas anteriores permanecen como historial del primer MVP.

- [x] 7.1 Extender `Project`, `ProjectInput` y `SettingsFile` con `LauncherChoice` (editor/terminal globales y overrides por proyecto), usando `null`/`auto` como herencia y defaults; verificar con tests de serialización y carga de JSON antiguo sin los campos nuevos.
- [x] 7.2 Implementar la detección de editores (`code`, `godot`, `godot4`) y terminales directas (`gnome-terminal`, `konsole`, `xfce4-terminal`, `kitty`, `alacritty`), excluyendo `x-terminal-emulator`; exponer disponibilidad y verificar con tests de PATH presente/ausente y de que el wrapper no se selecciona.
- [x] 7.3 Implementar un parser seguro de plantillas `{path}` con comillas simples/dobles y escapes, sin shell; verificar tests de sustitución, rutas con espacios/metacaracteres, plantilla vacía, plantilla sin `{path}` y comillas sin cerrar.
- [x] 7.4 Resolver el lanzador efectivo (override → global → automático) y ejecutar las acciones `editor`/`terminal`; verificar con tests la precedencia, `godot --editor --path`, comandos personalizados y la regresión de terminal que comprueba `--working-directory` en `gnome-terminal`.
- [x] 7.5 Añadir la configuración global de lanzadores en Ajustes (automático, VS Code, Godot, terminales detectadas y comando personalizado) con validación y persistencia; verificar con tests de cambio de default, comando inválido y herramienta no disponible.
- [x] 7.6 Añadir al formulario de proyecto la sección “Lanzadores” con «Heredar» y overrides de editor/terminal; verificar con tests de alta, edición, herencia del global y persistencia tras reiniciar.
- [x] 7.7 Actualizar el menú de acciones con etiquetas dinámicas para el editor y la terminal efectivos, y deshabilitar las acciones cuando la herramienta no está disponible; verificar con tests de VS Code, Godot, comando personalizado y terminal ausente.
- [x] 7.8 Actualizar `README.md`, `docs/catalog.md` y `docs/manual-tests.md` con la configuración global/por proyecto, la tabla de terminales y la nota de que `x-terminal-emulator` ya no se usa; verificar que los comandos y pasos documentados coinciden con la implementación.
- [x] 7.9 Ejecutar `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run tauri build -- --bundles deb,appimage` y `openspec validate add-project-dashboard --strict`; verificar manualmente que la terminal abre en la ruta real y que la app instalada sigue arrancando.

## Workflow follow-up

- Archivar el cambio con `/opsx-archive` después de la implementación y la revisión del usuario.
- Actualizar el estado de las subtareas del proyecto "Project Viewer App" en Super Productivity al completar cada grupo.
