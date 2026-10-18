# Proposal

## Why

Al iniciar sesión en la PC, el usuario no tiene una vista única de los proyectos en los que está trabajando: tiene que recordar rutas, abrir el gestor de archivos y navegar carpeta por carpeta. Una ventana pequeña que aparezca al entrar y muestre esos proyectos activos en una grilla reduce esa fricción y centraliza el acceso a cada carpeta local.

## What Changes

- Nueva app de escritorio **Project Viewer** para Linux, construida con Tauri 2 + React + TypeScript.
- Ventana principal que muestra en una grilla los proyectos **activos** (los que el usuario no ha cerrado), con portada, nombre y ruta local.
- Creación y edición de proyectos desde la misma ventana: portada (imagen), nombre y ruta local.
- Cierre (archivo) de proyectos para quitarlos de la grilla, con una vista de archivados para restaurarlos o eliminarlos definitivamente.
- Menú de acciones al hacer clic en una tarjeta: abrir la carpeta en el gestor de archivos, abrirla en VS Code o abrir una terminal en esa ruta.
- Persistencia local del catálogo y de las portadas en el directorio de datos de la app, sin servicios externos ni cuentas.
- Arranque automático al iniciar sesión en Linux (XDG Autostart), con opción para activarlo o desactivarlo desde la app e instancia única.
- Empaquetado para Linux (`.deb` y AppImage) como entregable inicial.
- **Fuera de alcance (fase futura):** integración con Windows y macOS, sincronización en la nube y descubrimiento automático de proyectos en disco.

## Capabilities

### New Capabilities

- `project-catalog`: alta, edición, cierre, restauración y eliminación de proyectos; almacenamiento y validación de nombre, ruta local y portada; persistencia local resistente a corrupción.
- `project-dashboard`: ventana de inicio con grilla de proyectos activos, estado vacío, orden por actividad reciente y diseño responsive con desplazamiento.
- `project-actions`: menú de acciones por proyecto y apertura de la carpeta en gestor de archivos, VS Code o terminal, con detección de herramientas y manejo de rutas inválidas.
- `linux-autostart`: arranque de la app al iniciar sesión en Linux, instancia única y control de la preferencia de autostart.

### Modified Capabilities

Ninguna: el proyecto no tiene specs existentes (es greenfield).

## Impact

- **Código nuevo:** proyecto Tauri 2 (Rust) con frontend React/TypeScript y configuración de Vite; no hay código previo que modificar.
- **Dependencias:** Tauri CLI/API, plugins `dialog`, `autostart` y `single-instance`; crates `serde`, `uuid`, `thiserror`, `infer`; React 19, TypeScript, Vite, Vitest y Testing Library.
- **Sistema (Ubuntu 26.04 / GNOME Wayland):** requiere `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev` y `build-essential`; Rust 1.99 ya está instalado en `~/.cargo/bin` pero no está en el `PATH` de shells no interactivos.
- **Integraciones del escritorio:** `xdg-open` (gestor de archivos), `code` (VS Code) y `x-terminal-emulator` (terminal), todas disponibles en el equipo; las acciones se desactivan si falta la herramienta.
- **Datos:** catálogo JSON y copias de portadas en el directorio de datos de la app (`app_data_dir`), más una entrada XDG Autostart en `~/.config/autostart/`.
- **Sin cambios** en APIs, servicios remotos ni datos existentes.
