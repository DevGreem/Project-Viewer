# Proposal

## Why

Al iniciar sesión, el usuario necesita una vista única de sus proyectos activos y acceso rápido a cada carpeta. Además, la acción de terminal abre desde el directorio home porque el wrapper `x-terminal-emulator` de Debian descarta `--working-directory`, y el editor está fijado a VS Code. El usuario necesita corregir ese comportamiento y poder elegir editor y terminal globales y por proyecto, por ejemplo para abrir ciertos proyectos con Godot.

## What Changes

- App de escritorio **Project Viewer** para Linux con Tauri 2 + React + TypeScript.
- Grilla de proyectos activos con portada, nombre y ruta local; creación, edición, cierre, restauración y eliminación desde la misma ventana.
- Menú de acciones por tarjeta: abrir carpeta, abrir en el editor configurado y abrir la terminal configurada.
- **Corrección:** la terminal debe iniciar en la ruta del proyecto. Se dejan de usar wrappers que descartan el directorio de trabajo; si no hay una terminal compatible, la acción se deshabilita en vez de abrir desde `~`.
- **Configuración global de lanzadores:** editor y terminal por defecto, con opción automática, herramientas detectadas o comando personalizado.
- **Configuración por proyecto:** cada proyecto puede heredar los valores globales o definir su propio editor y terminal. Godot se abre con `godot --editor --path <ruta>` (o `godot4`).
- **Detección de herramientas:** VS Code, Godot (`godot`/`godot4`) y terminales directas compatibles. Las opciones no detectadas se pueden guardar con aviso, pero su acción queda deshabilitada.
- **Comandos personalizados seguros:** plantillas con `{path}`, ejecutadas sin shell, con la ruta sustituida como un único argumento.
- **Menú dinámico:** la etiqueta del editor y de la terminal refleja el lanzador efectivo del proyecto.
- Persistencia local del catálogo, portadas, preferencias de lanzadores y autostart; sin cuentas ni servicios externos.
- Arranque automático al iniciar sesión en Linux (XDG Autostart), instancia única y empaquetado `.deb`/AppImage.
- **Fuera de alcance:** integración con Windows/macOS, sincronización en la nube, descubrimiento automático de proyectos y la idea que quedó inconclusa en el mensaje del usuario.

## Capabilities

### New Capabilities

- `project-catalog`: alta, edición, cierre, restauración y eliminación de proyectos; nombre, ruta, portada y preferencias opcionales de editor/terminal; persistencia local resistente a corrupción.
- `project-dashboard`: ventana compacta con grilla, estado vacío, archivados, formulario de proyecto y configuración global de lanzadores.
- `project-actions`: resolución de editor/terminal global o por proyecto, detección de herramientas, comandos personalizados, apertura con directorio de trabajo correcto y manejo seguro de errores.
- `linux-autostart`: arranque al iniciar sesión, preferencia persistente e instancia única.

### Modified Capabilities

Ninguna: el proyecto no tiene specs principales existentes; este cambio sigue siendo la primera especificación del producto.

## Impact

- **Datos:** `settings.json` incorpora editor y terminal globales; cada proyecto puede guardar overrides opcionales de editor/terminal. Los proyectos y ajustes existentes se cargan con `Heredar`/`Automático`, sin migración manual.
- **Backend:** nuevas estructuras de preferencias, detección de editores/terminales, parser de plantillas `{path}`, resolución de lanzador efectivo y acción genérica `editor` en lugar de `vscode`.
- **Integraciones:** `code`, `godot`/`godot4` y terminales directas (`gnome-terminal`, `konsole`, `xfce4-terminal`, `kitty`, `alacritty`). Se excluye `x-terminal-emulator` como candidato porque su wrapper no respeta el directorio de trabajo.
- **Frontend:** panel de ajustes globales, sección de lanzadores en el formulario de proyecto y etiquetas dinámicas en el menú de acciones.
- **Sin breaking changes para el usuario:** los proyectos sin override siguen usando el lanzador global; si no hay configuración, se usa la detección automática.
- **Pruebas:** tests de migración de datos, detección, parser de comandos, precedencia de overrides, regresión de terminal desde la ruta y UI.
