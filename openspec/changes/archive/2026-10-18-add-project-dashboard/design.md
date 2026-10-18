# Design

## Context

La primera implementación Linux de Project Viewer ya existe: Tauri 2 + React/TypeScript, catálogo JSON, portadas, archivado, acciones de apertura y autostart. Este cambio sigue activo y ahora incorpora una revisión de los lanzadores:

- La acción de terminal usa `x-terminal-emulator`, cuyo wrapper de Debian solo traduce las opciones de la interfaz `x-terminal-emulator` y **descarta** `--working-directory`; por eso `gnome-terminal` termina abriendo desde `~`.
- El editor está fijado a VS Code. El usuario necesita un editor y una terminal globales y, por proyecto, la posibilidad de heredar o definir un override (por ejemplo, Godot para proyectos de Godot).

Entorno objetivo: Ubuntu 26.04 LTS, GNOME/Wayland, Rust 1.99, Node 22.22. Herramientas presentes: `xdg-open`, `code`, `godot` (`/usr/local/bin/godot`), `gnome-terminal` y `x-terminal-emulator` (wrapper). Restricciones: app local, una sola ventana, Linux primero, sin cuentas ni red.

## Goals / Non-Goals

**Goals:**

- Corregir la terminal para que siempre abra en la ruta del proyecto.
- Ofrecer editor y terminal globales con opción automática, detección o comando personalizado.
- Permitir overrides independientes de editor y terminal por proyecto, con herencia del global.
- Mantener la ejecución sin shell y el manejo visible de errores.
- Conservar compatibilidad con los proyectos y ajustes existentes.

**Non-Goals:**

- Windows/macOS (fase futura).
- Sincronización, cuentas, telemetría o red.
- Auto-descubrimiento o importación masiva de carpetas.
- Orden manual por arrastre, múltiples ventanas o bandeja del sistema.
- Ejecutar scripts de shell arbitrarios: las plantillas personalizadas son argv, no shells.
- La idea que quedó inconclusa en el mensaje del usuario; no forma parte de este cambio.
- Internacionalización completa; la interfaz se entrega en español.

## Decisions

### D1. Stack: Tauri 2 + React 19 + TypeScript + Vite

**Decisión:** mantener Tauri 2 con frontend React 19, TypeScript y Vite; CSS global con tokens y estado con hooks, sin router ni librería de UI.

**Por qué:** el backend Rust resuelve persistencia, detección de herramientas, ejecución de procesos y autostart; el frontend queda ligero. WebKitGTK ya es el motor del escritorio GNOME.

**Alternativas:** Electron (más peso), Python + Qt (peor integración con Tauri), web app (no puede abrir rutas locales ni autostart).

### D2. Persistencia y modelo de lanzadores

**Decisión:** mantener el catálogo en `app_data_dir/projects.json` y las preferencias en `settings.json`, con escritura atómica. Los campos nuevos son opcionales para no requerir migración manual.

**Proyecto:**

```json
{
  "id": "uuid-v4",
  "name": "Mi juego",
  "path": "/home/ian/proyectos/mi-juego",
  "cover": "covers/<uuid>-<timestamp>.png",
  "status": "active",
  "createdAt": 1760000000000,
  "updatedAt": 1760000000000,
  "archivedAt": null,
  "editor": { "kind": "godot" },
  "terminal": { "kind": "gnome-terminal" }
}
```

- `editor` y `terminal` son opcionales. `null` o ausentes significan **heredar** el valor global.
- Cada override usa `{ "kind": "<id>", "command": "<plantilla>" }`; `command` solo aplica a `kind: "custom"`.
- `kind` de editor: `auto`, `vscode`, `godot`, `custom`.
- `kind` de terminal: `auto`, `gnome-terminal`, `konsole`, `xfce4-terminal`, `kitty`, `alacritty`, `custom`.
- Los proyectos antiguos cargan sin los campos y heredan; no se reescriben hasta que el usuario los edite.

**Ajustes globales:**

```json
{
  "version": 1,
  "autostartInitialized": true,
  "autostartEnabled": true,
  "defaultEditor": { "kind": "auto" },
  "defaultTerminal": { "kind": "auto" }
}
```

- Se mantiene `version: 1` porque los campos nuevos son opcionales y compatibles; una migración futura podrá incrementarla si cambia la semántica.
- `defaultEditor`/`defaultTerminal` usan los mismos tipos, sin `inherit`; `auto` delega en la detección.
- La UI muestra el valor global efectivo cuando un proyecto hereda.

**Recuperación:** se mantiene el respaldo `projects.corrupt-<epoch>.json`, el arranque vacío informado y la escritura `tmp → fsync → rename`.

### D3. Portadas: copia gestionada con validación real

Sin cambios respecto de la implementación actual: PNG/JPEG/WebP/GIF hasta 5 MB, validación por bytes mágicos, staging en `covers/staged-*`, promoción a `covers/<project-id>-<timestamp>-<suffix>.<ext>`, borrado de la anterior y limpieza de staged al arrancar. La visualización usa el protocolo de assets limitado a `$APPDATA/covers/**`.

### D4. Validación de rutas y unicidad en Rust

Sin cambios: nombre 1–80 caracteres, ruta opcional absoluta, existente y directorio, canonicalización, unicidad entre proyectos activos y autoridad del backend sobre la UI.

### D5. Lanzadores configurables y terminal con directorio correcto

**Causa del bug:** `x-terminal-emulator` apunta a `gnome-terminal.wrapper`, que solo procesa las opciones de la interfaz `x-terminal-emulator` y no reenvía `--working-directory`. Al no reconocerla, `gnome-terminal` arranca con el directorio del proceso (home). La solución es no usar ese wrapper y preferir binarios directos con su flag de directorio.

**Resolución del lanzador efectivo:**

1. Override del proyecto (`editor`/`terminal` no nulo).
2. Valor global (`defaultEditor`/`defaultTerminal`).
3. Detección automática.

`Heredar` equivale a `null` en el proyecto. `auto` en el global usa el primer candidato disponible.

**Editores:**

| `kind` | Comando | Detección |
| --- | --- | --- |
| `vscode` | `code <path>` | `code` en PATH/rutas habituales |
| `godot` | `godot --editor --path <path>` | `godot`, luego `godot4` |
| `custom` | plantilla con `{path}` | solo se valida la plantilla y el ejecutable |

No se exige `project.godot`: si la ruta no es un proyecto Godot, Godot decide si abre el proyecto o su gestor.

**Terminales:**

| `kind` | Args con directorio | Nota |
| --- | --- | --- |
| `gnome-terminal` | `--working-directory=<path>` | Preferida en GNOME |
| `konsole` | `--workdir <path>` | |
| `xfce4-terminal` | `--working-directory=<path>` | |
| `kitty` | `--directory <path>` | |
| `alacritty` | `--working-directory <path>` | |
| `custom` | plantilla con `{path}` | Debe incluir `{path}` |

`x-terminal-emulator` **no** es candidato. Si solo existe el wrapper, la acción de terminal queda deshabilitada con una explicación; nunca se abre desde `~`.

**Detección:** el backend busca en PATH, `/usr/bin`, `/usr/local/bin`, `~/.local/bin` y `/snap/bin`. Expone editores y terminales con `{ id, label, available }`; las opciones no disponibles se pueden guardar con aviso, pero su acción se deshabilita.

**Comandos personalizados:** plantilla con `{path}`, tokenizada con comillas simples/dobles y escapes, y ejecutada directamente con `std::process::Command` (sin `sh -c`). `{path}` se sustituye como un único argumento incluso si contiene espacios o metacaracteres. Se rechazan plantillas vacías, sin `{path}` o con comillas sin cerrar. Para terminal personalizada, `{path}` es obligatorio para garantizar el directorio.

**Acciones:** `open_project_action(projectId, action)` acepta `folder`, `editor` y `terminal`. El backend resuelve el lanzador, revalida la ruta y lanza; los errores usan códigos estables. La UI consulta `get_launcher_availability` y `get_launcher_settings`.

**Por qué no usar `x-terminal-emulator` con `-e`:** obligaría a construir un comando de shell (`cd ... && ...`), justo lo que este diseño evita por seguridad y por manejo de rutas con caracteres especiales.

### D6. Autostart e instancia única

Sin cambios: `tauri-plugin-autostart` con argumento `--autostart`, entrada XDG con `Exec` entrecomillado (incluido AppImage), preferencia persistida y `tauri-plugin-single-instance` registrado primero. La ventana se muestra al arrancar manualmente o por autostart.

### D7. Arquitectura de la UI

- `Header` mantiene “Nuevo proyecto”, el contador de archivados y el acceso a ajustes.
- Los ajustes pasan a un modal o panel ampliado con dos secciones: **Inicio** (autostart) y **Lanzadores** (editor/terminal globales, opción automática, herramientas detectadas y comando personalizado).
- `ProjectFormModal` añade una sección **Lanzadores** con selects independientes para editor y terminal. Cada select incluye «Heredar (<valor global>)» y las opciones detectadas; «Personalizado» muestra un campo de plantilla con `{path}`.
- `ActionMenu` recibe el lanzador efectivo y muestra etiquetas dinámicas: “Abrir en VS Code”, “Abrir en Godot”, “Abrir con editor personalizado”, “Abrir terminal (gnome-terminal)”.
- Si una herramienta no está disponible, el ítem se deshabilita con un `title`/texto de ayuda. El formulario permite guardar la preferencia con aviso.
- `Toast` sigue mostrando errores de validación y lanzamiento.
- La UI no escribe archivos: todas las mutaciones pasan por comandos Tauri.

### D8. Contrato de errores

Se mantienen los códigos actuales y se añaden:

- `INVALID_LAUNCHER_CONFIG`: kind desconocido o combinación inválida.
- `INVALID_COMMAND_TEMPLATE`: plantilla vacía, sin `{path}` o con comillas inválidas.
- `LAUNCHER_NOT_AVAILABLE`: la herramienta configurada no está instalada.
- `PROJECT_NOT_GODOT` no se usa: Godot se abre aunque no exista `project.godot`.

El frontend traduce los códigos a mensajes en español; el detalle técnico se conserva para diagnóstico.

### D9. Estrategia de pruebas

- **Rust:** migración/carga de proyectos y ajustes sin los campos nuevos; detección de editores/terminales; exclusión de `x-terminal-emulator`; precedencia override → global → auto; parser de plantillas con comillas, espacios y metacaracteres; regresión de terminal con `--working-directory`; ejecución de `editor`/`terminal`; errores de configuración.
- **Frontend:** ajustes globales, formulario con “Heredar” y overrides, etiquetas dinámicas del menú, estados deshabilitados, validación de plantillas y persistencia de preferencias.
- **Manual:** abrir terminal en un proyecto real y comprobar `pwd`; abrir Godot y VS Code; probar un comando personalizado; reiniciar la app y verificar que los overrides persisten.
- **Empaquetado:** `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`, `npm run typecheck`, `npm run test`, `npm run build` y `npm run tauri build -- --bundles deb,appimage`.

## Risks / Trade-offs

| Riesgo | Mitigación |
| --- | --- |
| `x-terminal-emulator` ignora el directorio de trabajo | Eliminarlo de candidatos; usar binarios directos; test de regresión y acción deshabilitada si solo existe el wrapper |
| Godot se invoca con nombres distintos según instalación | Detectar `godot` y `godot4`; probar ambos en tests de detección |
| Una plantilla personalizada puede ser ambigua o insegura | Parser propio sin shell, `{path}` como argumento único, rechazo de plantillas inválidas y tests con metacaracteres |
| Los ajustes/proyectos antiguos no tienen los campos nuevos | Campos opcionales con defaults (`inherit`/`auto`); tests de carga de JSON antiguo |
| El modal de ajustes crece demasiado | Separar secciones Inicio/Lanzadores y mantener el formulario de proyecto enfocado en el override |
| Una herramienta configurada desaparece del sistema | Guardar la preferencia con aviso y deshabilitar la acción hasta que vuelva a estar disponible |
| El cambio de `vscode` a `editor` rompe la API interna | Actualizar frontend, tests y documentación en el mismo cambio; no hay consumidores externos |

## Migration Plan

1. Extender los tipos y la serialización con `LauncherChoice`, `defaultEditor`, `defaultTerminal`, `editor` y `terminal`; cargar datos antiguos con `inherit`/`auto` y tests.
2. Implementar detección de editores/terminales y el parser de plantillas.
3. Implementar la resolución de lanzadores y las acciones `editor`/`terminal`, con regresión de cwd.
4. Añadir ajustes globales y el formulario de override.
5. Actualizar el menú dinámico, textos, README y docs.
6. Ejecutar suite completa, build `.deb`/AppImage y verificación manual.
7. Revisar y archivar el cambio solo cuando el grupo 7 esté completo.

**Rollback:** los campos nuevos son opcionales; volver a una versión anterior no elimina los datos existentes. Las preferencias desconocidas se ignoran y los proyectos siguen abriendo con el comportamiento anterior. No se requiere migración destructiva.
