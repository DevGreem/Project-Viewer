# Design

## Context

Proyecto greenfield: solo existen el `README.md` y el andamiaje de OpenSpec. No hay código, dependencias ni datos previos que migrar. La implementación se guía por `proposal.md` y por las specs de `project-catalog`, `project-dashboard`, `project-actions` y `linux-autostart`.

Entorno objetivo inmediato:

- Ubuntu 26.04 LTS, GNOME sobre Wayland.
- Node.js 22.22 y npm 9.2 disponibles.
- Rust 1.99 en `~/.cargo/bin`, pero fuera del `PATH` de shells no interactivos.
- `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev` y `librsvg2-dev` aún no están instalados; `build-essential` sí.
- Herramientas de escritorio detectadas: `xdg-open`, `code`, `x-terminal-emulator` (apunta a `gnome-terminal.wrapper`).
- Autostart de usuario en `~/.config/autostart` (GNOME).

Restricciones de diseño: app local sin cuentas ni red, una sola ventana, datos en el directorio del usuario, Linux primero y sin descubrimiento automático de carpetas.

## Goals / Non-Goals

**Goals:**

- Entregar una app Tauri 2 instalable en Linux que abra una ventana compacta al iniciar sesión.
- Mantener el catálogo y las portadas en disco con escrituras atómicas y recuperación ante corrupción.
- Ofrecer un flujo único de tarjeta → menú → acción/edición/cierre, con teclado y foco accesibles.
- Ejecutar aperturas de carpeta, VS Code y terminal sin pasar rutas por un shell.
- Gestionar autostart XDG e instancia única sin privilegios.

**Non-Goals:**

- Windows/macOS (fase futura registrada en Super Productivity).
- Sincronización, cuentas, telemetría o red.
- Auto-descubrimiento o importación masiva de carpetas.
- Orden manual por arrastre, múltiples ventanas o bandeja del sistema.
- Editor/terminal configurables por el usuario; se usan VS Code y la terminal detectada.
- Internacionalización completa; la interfaz se entrega en español.

## Decisions

### D1. Stack: Tauri 2 + React 19 + TypeScript + Vite

**Decisión:** usar Tauri 2 con frontend React 19, TypeScript y Vite; CSS Modules y estado con hooks/reducer, sin router ni librería de UI.

**Por qué:** el backend Rust resuelve con precisión persistencia, validación de rutas, ejecución de procesos y autostart; el frontend queda ligero y la ventana nativa consume menos memoria que Electron. WebKitGTK ya es el motor del escritorio GNOME.

**Alternativas:** Electron (más peso y consumo), Python + Qt (peor integración con el ecosistema Tauri y el empaquetado elegido), web app (no puede abrir rutas locales ni autostart).

**Límite:** Tauri exige las dependencias de WebKitGTK y un toolchain Rust; se instalan una vez en la fase de setup.

### D2. Persistencia: un JSON versionado con escritura atómica

**Decisión:** guardar el catálogo en `app_data_dir/projects.json` con un formato versionado y escritura `tmp → fsync → rename`. Mantener el catálogo en memoria detrás de un `Mutex` y serializar las mutaciones.

**Modelo:**

```json
{
  "version": 1,
  "projects": [
    {
      "id": "uuid-v4",
      "name": "Project Viewer",
      "path": "/home/ian/Documents/remote/github/Project-Viewer",
      "cover": "covers/<uuid>-<timestamp>.png",
      "status": "active",
      "createdAt": 1760000000000,
      "updatedAt": 1760000000000,
      "archivedAt": null
    }
  ]
}
```

- `path` se guarda canónico (absoluto, resuelto con `canonicalize`) y puede ser `null`.
- `status` es `active` o `archived`; `archivedAt` solo aplica al segundo.
- Las fechas son epoch en milisegundos y `updatedAt` ordena la grilla.
- `settings.json` separado guarda `version`, `autostartInitialized` y `autostartEnabled`; no mezcla preferencias con el catálogo.

**Por qué no SQLite:** el volumen esperado es de decenas o pocos cientos de proyectos; un JSON versionado es fácil de inspeccionar, respaldar y testear, y evita una dependencia nativa. Si el catálogo crece, el formato versionado permite migrar.

**Recuperación:** si `projects.json` no parsea, se renombra a `projects.corrupt-<epoch>.json`, se arranca con catálogo vacío y se devuelve un aviso no bloqueante al frontend. Un fallo de escritura no altera el archivo anterior.

### D3. Portadas: copia gestionada con validación real

**Decisión:** aceptar solo PNG, JPEG, WebP y GIF de hasta 5 MB, validando los bytes mágicos además de la extensión. Al elegir una imagen se copia a `covers/staged-<uuid>.<ext>` para previsualizarla; al guardar se renombra a `covers/<uuid>-<timestamp>.<ext>`, se actualiza el catálogo y se borra la portada anterior. Al cancelar se elimina el archivo staged; al arrancar se limpian staged huérfanos.

**Por qué copiar:** una ruta externa puede desaparecer o cambiar y romper la tarjeta. La copia desacopla la portada del archivo original.

**Visualización:** protocolo de assets de Tauri limitado a `$APPDATA/covers/**`; nombres únicos por versión para evitar caché de WebKit. Sin portada o con error de lectura se muestra un marcador con iniciales y color derivado del `id`.

**Alternativas:** guardar solo la ruta original (frágil), base64 en el JSON (infla el catálogo), SVG (superficie de riesgo innecesaria).

### D4. Validación de rutas y unicidad en Rust

**Decisión:** validar en el backend, no solo en el formulario:

- Nombre obligatorio, recortado, entre 1 y 80 caracteres.
- Ruta opcional; si existe, debe ser absoluta, existir y ser un directorio; se canonicaliza antes de guardar.
- No se permiten dos proyectos `active` con la misma ruta canónica; el error incluye el nombre del proyecto que la ocupa.
- La UI valida para dar feedback inmediato, pero la respuesta de Rust es la autoridad.

**Por qué:** evita que una ruta relativa, un archivo o un duplicado entren por una ruta alternativa de la UI, y deja la lógica testeable sin WebView.

### D5. Apertura de herramientas: comandos directos, sin shell

**Decisión:** un comando Rust `open_project_action(projectId, action)` con `action` restringida a `folder`, `vscode` o `terminal`. Antes de lanzar, verifica que la ruta siga existiendo y sea un directorio. Usa `std::process::Command` con la ruta como argumento único; nunca `sh -c`.

| Acción | Comando preferido | Alternativas / nota |
| --- | --- | --- |
| Abrir carpeta | `xdg-open <path>` | Requerido en Linux; error visible si no hay handler |
| Abrir en VS Code | `code <path>` | Si no está en `PATH`, buscar en `/usr/bin`, `/usr/local/bin`, `~/.local/bin` y `/snap/bin` |
| Abrir terminal | `x-terminal-emulator --working-directory=<path>` | `gnome-terminal --working-directory`, `konsole --workdir`, `xfce4-terminal --working-directory`, `kitty --directory`, `alacritty --working-directory` |

La UI consulta `get_action_availability` al cargar y deshabilita las acciones cuya herramienta no existe, con una explicación. Si el lanzamiento falla, el backend devuelve un código (`TOOL_NOT_FOUND`, `PATH_UNAVAILABLE`, `SPAWN_FAILED`) y el frontend muestra un toast; el menú se cierra y la app sigue operativa.

**Por qué no el plugin `opener`:** solo cubre abrir rutas/URLs; no abre VS Code ni una terminal con directorio de trabajo. Un único servicio Rust concentra validación, detección y errores.

### D6. Autostart e instancia única

**Decisión:** usar `tauri-plugin-autostart` (registra XDG Autostart en Linux y resuelve `$APPIMAGE` cuando corresponde) y `tauri-plugin-single-instance` (registrado antes que el resto de plugins).

- En la primera ejecución de una build empaquetada, si `autostartInitialized` es falso, se habilita el autostart y se marca la preferencia. En desarrollo no se habilita por defecto.
- En cada arranque, si el autostart está habilitado, se vuelve a llamar `enable()` de forma idempotente para refrescar la ruta del ejecutable.
- El engranaje de la cabecera expone un checkbox que llama a `set_autostart_enabled`; el estado mostrado se obtiene de `get_autostart_enabled`.
- La ventana se muestra siempre, tanto en arranque manual como con el argumento `--autostart`; el plugin single-instance enfoca la ventana existente si se intenta una segunda ejecución.

**Por qué el plugin:** ya contempla el caso AppImage (evita apuntar a la ruta temporal de montaje) y el formato XDG, reduciendo código específico de plataforma.

**Riesgo asumido:** GNOME/Wayland puede impedir el robo de foco; se intenta `show` + `unminimize` + `set_focus`, y si el compositor lo bloquea la ventana queda visible en la barra de tareas.

### D7. Arquitectura de la UI

- `App` mantiene `view: "active" | "archived"`, catálogo, estado de carga/error y toasts.
- `Header` contiene "Nuevo proyecto", contador de archivados y menú de ajustes (autostart).
- `ProjectGrid` usa `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))` y ordena por `updatedAt` descendente.
- `ProjectCard` muestra portada/placeholder, nombre, ruta truncada y abre `ActionMenu` (portal a `body`, posicionado con `getBoundingClientRect`).
- `ProjectFormModal` usa `<dialog>` nativo con `showModal()` para foco atrapado y Escape; al cerrar devuelve el foco al disparador. Los campos incluyen nombre, ruta con selector nativo y portada con vista previa.
- `ArchivedView` reutiliza las tarjetas en modo archivado con "Restaurar" y "Eliminar" (confirmación explícita).
- `Toast` anuncia errores y confirmaciones; `role="status"`/`aria-live`.
- Iconos SVG inline; sin librería de componentes. Textos de interfaz centralizados en `src/i18n/es.ts`.

La UI nunca escribe archivos directamente: toda mutación pasa por comandos Tauri que devuelven el catálogo actualizado o un error tipado.

### D8. Contrato de errores

El backend devuelve `{ code, message, details? }` con códigos estables (`INVALID_NAME`, `INVALID_PATH`, `DUPLICATE_PATH`, `COVER_UNSUPPORTED`, `COVER_TOO_LARGE`, `CATALOG_READ_FAILED`, `TOOL_NOT_FOUND`, `SPAWN_FAILED`, `AUTOSTART_FAILED`). El frontend traduce los códigos a mensajes en español y conserva el detalle técnico en un tooltip o log. Esto permite testear el backend por código sin acoplar los tests a textos de UI.

### D9. Estrategia de pruebas

- **Rust (`cargo test`):** round-trip del catálogo, escritura atómica, recuperación de JSON corrupto, validación de nombre/ruta, canonicalización, duplicados entre activos, validación de portadas por bytes mágicos/tamaño y construcción de argumentos de las acciones (sin shell).
- **Frontend (`vitest` + Testing Library + jsdom):** grilla solo con activos, orden por `updatedAt`, estado vacío, vista de archivados, validación del formulario, acciones deshabilitadas sin ruta o sin herramienta, toggle de autostart y foco/Escape del modal (con polyfill de `<dialog>`).
- **Manual en escritorio:** selector nativo de carpeta/portada, apertura real de gestor de archivos/VS Code/terminal, persistencia tras reinicio, corrupción simulada del JSON, entrada XDG generada y arranque con `--autostart`.
- **Empaquetado:** `npm run tauri build -- --bundles deb,appimage`; validar el `.desktop` con `desktop-file-validate` y probar la instalación del `.deb`.

## Risks / Trade-offs

| Riesgo | Mitigación |
| --- | --- |
| Faltan dependencias WebKitGTK y el build falla | Instalar `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev` y `build-essential` antes de compilar; documentarlo en README |
| Rust no está en el `PATH` de shells no interactivos | Ejecutar `source ~/.cargo/env` en los scripts de build o usar `~/.cargo/bin/cargo` explícitamente |
| Autostart apunta a una ruta temporal en AppImage | El plugin usa `$APPIMAGE`; probar el AppImage empaquetado, no solo `target/release` |
| GNOME Wayland no concede foco al segundo lanzamiento | Intentar `show`/`unminimize`/`set_focus`; aceptar que el compositor pueda limitarlo y dejar la ventana visible |
| Comando `code` no está en `PATH` (snap/instalación local) | Búsqueda en rutas habituales; si no aparece, acción deshabilitada con explicación |
| Terminal sin flag homogéneo para directorio de trabajo | Tabla de candidatos con flags específicos; probar `x-terminal-emulator` en Ubuntu y degradar a terminal sin cwd solo si se informa |
| Portada reemplazada se muestra cacheada | Nombre de archivo único por versión (`<uuid>-<timestamp>.<ext>`) |
| JSON corrupto o escritura interrumpida | Escritura atómica, respaldo `projects.corrupt-<epoch>.json` y arranque vacío informado |
| Ruta canónica duplicada por symlinks/bind mounts | Canonicalización y comparación; el error muestra el proyecto que ocupa la ruta |
| Datos de prueba contaminan el perfil real | En debug/test, permitir `PROJECT_VIEWER_DATA_DIR` para aislar el directorio de datos |
| AppImage requiere bibliotecas del sistema no incluidas | Probar el AppImage en una sesión limpia; si falla, priorizar `.deb` como entrega principal |

## Migration Plan

1. Instalar dependencias del sistema y verificar `rustc`, `cargo`, `node` y `npm`.
2. Generar el esqueleto Tauri 2 + React/TS, fijar identificador `com.ian.projectviewer`, nombre `Project Viewer` y ventana 960×640 (mínimo 720×480).
3. Implementar catálogo, portadas y validaciones con tests Rust antes de conectar la UI.
4. Construir la ventana, grilla, formulario, menú, archivados y accesibilidad; cubrir con tests de frontend.
5. Implementar acciones de apertura y disponibilidad de herramientas.
6. Integrar autostart e instancia única; probar con build empaquetada.
7. Empaquetar `.deb` y AppImage, instalar, reiniciar sesión y verificar el arranque automático.

**Rollback:** al ser greenfield no hay datos existentes que restaurar. Basta con desinstalar el paquete, eliminar `~/.config/autostart/project-viewer.desktop` y, si se desea, borrar el directorio de datos `app_data_dir`. Las versiones futuras del catálogo usarán `version` para migrar; este cambio no requiere migración.
