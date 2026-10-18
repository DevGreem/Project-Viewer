# project-actions Specification

## Purpose

Permite abrir cada proyecto en el gestor de archivos, en el editor configurado o en la terminal configurada —global o por proyecto— de forma segura y con errores visibles.

## Requirements

### Requirement: Menú de acciones de apertura

El menú de una tarjeta DEBE (SHALL) ofrecer «Abrir carpeta», «Abrir en <editor>» y «Abrir terminal (<terminal>)». La etiqueta DEBE reflejar el lanzador efectivo. Si no hay ruta o el lanzador no está disponible, la acción DEBE quedar deshabilitada con una explicación.

#### Scenario: Proyecto con ruta y lanzadores configurados

- **WHEN** el usuario abre el menú de un proyecto con ruta, editor global VS Code y terminal global GNOME Terminal
- **THEN** ve «Abrir carpeta», «Abrir en VS Code» y «Abrir terminal (gnome-terminal)» habilitadas

#### Scenario: Proyecto sin ruta local

- **WHEN** el usuario abre el menú de un proyecto sin ruta
- **THEN** las tres acciones de apertura aparecen deshabilitadas y el menú explica que debe asignarse una ruta

#### Scenario: Lanzador no disponible

- **WHEN** el proyecto usa Godot pero `godot` no está instalado
- **THEN** la acción de editor aparece deshabilitada y una ayuda indica que la herramienta no está disponible

### Requirement: Abrir la carpeta en el gestor de archivos

La acción «Abrir carpeta» DEBE (SHALL) lanzar el gestor de archivos predeterminado del sistema en la ruta del proyecto, sin bloquear la interfaz de la app.

#### Scenario: Abrir una carpeta existente

- **WHEN** el usuario elige «Abrir carpeta» en un proyecto cuya ruta existe
- **THEN** el gestor de archivos del sistema se abre mostrando el contenido de esa carpeta y la app sigue utilizable

#### Scenario: Ruta eliminada después de guardar

- **WHEN** el usuario intenta abrir un proyecto cuya carpeta ya no existe
- **THEN** la app muestra un error que indica que la ruta no está disponible y sugiere editarla

### Requirement: Abrir en el editor configurado

La acción de editor DEBE (SHALL) resolver primero el override del proyecto, luego el editor global y finalmente la detección automática. DEBE lanzar VS Code con `code <ruta>`, Godot con `godot --editor --path <ruta>` o `godot4`, o la plantilla personalizada. Si el editor no está disponible, DEBE deshabilitarse con una explicación.

#### Scenario: Abrir con VS Code

- **WHEN** el lanzador efectivo es VS Code y la herramienta está instalada
- **THEN** VS Code se abre con la carpeta del proyecto como raíz de trabajo

#### Scenario: Abrir con Godot

- **WHEN** el proyecto tiene un override de Godot y `godot` está instalado
- **THEN** Godot abre el editor con la ruta del proyecto mediante `--path`, aunque la carpeta no contenga `project.godot`

#### Scenario: Abrir con un editor personalizado

- **WHEN** el lanzador efectivo es una plantilla personalizada con `{path}`
- **THEN** la app sustituye la ruta, lanza el comando configurado y abre el editor sin usar un shell

#### Scenario: Editor configurado no disponible

- **WHEN** el lanzador efectivo apunta a una herramienta que no está instalada
- **THEN** la acción de editor aparece deshabilitada y una ayuda explica qué herramienta falta

### Requirement: Resolución de lanzadores

Cada proyecto DEBE (SHALL) poder heredar el lanzador global o definir overrides independientes de editor y terminal. La resolución DEBE ser override del proyecto → valor global → automático; «Heredar» DEBE usar el global.

#### Scenario: Override del proyecto prevalece

- **WHEN** el editor global es VS Code y el proyecto define Godot
- **THEN** la acción de editor de ese proyecto abre Godot

#### Scenario: Proyecto hereda el valor global

- **WHEN** un proyecto no tiene override de editor
- **THEN** usa el editor global y, si este es automático, el primer editor detectado según el orden definido

#### Scenario: Cambiar el valor global

- **WHEN** el usuario cambia el editor global y un proyecto hereda ese valor
- **THEN** el proyecto pasa a usar el nuevo editor global sin editar el proyecto

### Requirement: Abrir una terminal en la ruta

La acción de terminal DEBE (SHALL) abrir una terminal directa con el directorio de trabajo inicial igual a la ruta del proyecto. NO DEBE usar `x-terminal-emulator` si su wrapper descarta el directorio. Si no hay una terminal compatible, la acción DEBE deshabilitarse con una explicación.

#### Scenario: Terminal directa abre en el proyecto

- **WHEN** el usuario abre la terminal en un proyecto con ruta `/home/ian/proyectos/app`
- **THEN** la terminal recibe `--working-directory=/home/ian/proyectos/app` o el argumento equivalente de su implementación y su directorio inicial es el proyecto

#### Scenario: Solo existe el wrapper x-terminal-emulator

- **WHEN** no hay una terminal directa compatible y solo está `x-terminal-emulator`
- **THEN** la acción de terminal aparece deshabilitada y no se abre una terminal desde `~`

#### Scenario: Terminal configurada por proyecto

- **WHEN** el proyecto define `konsole` como terminal y está instalada
- **THEN** se abre Konsole con el directorio de trabajo del proyecto, aunque el valor global sea otra terminal

### Requirement: Detección de editores y terminales

El sistema DEBE (SHALL) detectar VS Code, Godot (`godot`/`godot4`) y terminales directas compatibles, y DEBE exponer su disponibilidad a la UI. Las opciones no detectadas DEBEN poder guardarse con aviso, pero su acción DEBE quedar deshabilitada hasta que estén disponibles.

#### Scenario: Detectar herramientas instaladas

- **WHEN** la app arranca con `code`, `godot` y `gnome-terminal` en `PATH`
- **THEN** las opciones VS Code, Godot y GNOME Terminal aparecen disponibles en los ajustes y en el formulario de proyecto

#### Scenario: Herramienta no detectada

- **WHEN** el usuario elige una terminal que no está instalada
- **THEN** la preferencia se guarda con una advertencia y la acción queda deshabilitada hasta que la herramienta esté disponible

#### Scenario: Comando personalizado siempre disponible

- **WHEN** no se detecta ningún editor o terminal conocido
- **THEN** la opción de comando personalizado sigue disponible para que el usuario configure una herramienta propia

### Requirement: Comandos personalizados seguros

Los comandos personalizados DEBEN (SHALL) ser plantillas con `{path}`. El sistema DEBE sustituir `{path}` por la ruta como un único argumento, sin shell, admitiendo comillas; DEBE rechazar plantillas vacías o sin `{path}`. Los metacaracteres NO DEBEN ejecutar comandos adicionales.

#### Scenario: Editor personalizado con espacios

- **WHEN** la plantilla es `mi-editor --open {path}` y la ruta contiene espacios
- **THEN** el editor recibe la ruta como un único argumento y no se ejecuta ningún comando adicional

#### Scenario: Terminal personalizada

- **WHEN** la plantilla es `mi-terminal --cwd {path}` y la herramienta existe
- **THEN** la terminal se abre con la ruta sustituida en el argumento correspondiente

#### Scenario: Plantilla inválida

- **WHEN** el usuario guarda una plantilla vacía o sin `{path}`
- **THEN** la app rechaza el guardado con un mensaje que explica el requisito

#### Scenario: Metacaracteres en la ruta

- **WHEN** la ruta contiene `;`, `$`, `&` o comillas
- **THEN** se sustituye literalmente como argumento y no se ejecuta ningún comando adicional

### Requirement: Manejo de errores de apertura

Si una acción de apertura no puede ejecutarse, la app DEBE (SHALL) mostrar un mensaje que identifique la acción y el motivo, DEBE cerrar el menú y DEBE permanecer operativa sin cerrarse ni perder datos.

#### Scenario: Falla al lanzar una herramienta

- **WHEN** el sistema rechaza el lanzamiento del gestor de archivos, el editor configurado o la terminal configurada
- **THEN** la app muestra un aviso con la acción fallida y el motivo, y el usuario puede seguir usando el catálogo

### Requirement: Ejecución segura de acciones

Las acciones DEBEN (SHALL) ejecutarse sin shell: la ruta DEBE pasarse como un único argumento (o dentro de un único argumento de terminal), las plantillas personalizadas DEBEN parsearse a argv y solo DEBEN permitirse `folder`, `editor` y `terminal`.

#### Scenario: Acción no permitida

- **WHEN** la interfaz solicita una acción distinta de abrir carpeta, abrir editor o abrir terminal
- **THEN** la app rechaza la solicitud y no ejecuta ningún proceso
