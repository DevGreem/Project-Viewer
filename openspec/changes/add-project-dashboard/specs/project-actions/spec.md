# Spec Delta

## Purpose

Permite abrir cada proyecto en el gestor de archivos, en VS Code o en una terminal local, de forma segura y con errores visibles para el usuario.

## ADDED Requirements

### Requirement: Menú de acciones de apertura

Al abrir el menú de una tarjeta con ruta local, el sistema DEBE (SHALL) ofrecer las acciones "Abrir carpeta", "Abrir en VS Code" y "Abrir terminal". Si el proyecto no tiene ruta, las tres acciones DEBEN mostrarse deshabilitadas con una explicación de que primero debe asignarse una ruta.

#### Scenario: Proyecto con ruta local

- **WHEN** el usuario abre el menú de un proyecto que tiene una ruta válida
- **THEN** ve las tres acciones de apertura habilitadas junto con las acciones de edición y cierre

#### Scenario: Proyecto sin ruta local

- **WHEN** el usuario abre el menú de un proyecto sin ruta
- **THEN** las acciones de apertura aparecen deshabilitadas y el menú explica que debe asignarse una ruta

### Requirement: Abrir la carpeta en el gestor de archivos

La acción "Abrir carpeta" DEBE (SHALL) lanzar el gestor de archivos predeterminado del sistema en la ruta del proyecto, sin bloquear la interfaz de la app.

#### Scenario: Abrir una carpeta existente

- **WHEN** el usuario elige "Abrir carpeta" en un proyecto cuya ruta existe
- **THEN** el gestor de archivos del sistema se abre mostrando el contenido de esa carpeta y la app sigue utilizable

#### Scenario: Ruta eliminada después de guardar

- **WHEN** el usuario intenta abrir un proyecto cuya carpeta ya no existe
- **THEN** la app muestra un error que indica que la ruta no está disponible y sugiere editarla

### Requirement: Abrir en VS Code

La acción "Abrir en VS Code" DEBE (SHALL) abrir la carpeta del proyecto en VS Code cuando la herramienta esté disponible en el sistema. Si no está instalada, la acción DEBE aparecer deshabilitada con una explicación.

#### Scenario: VS Code disponible

- **WHEN** el usuario elige "Abrir en VS Code" y la herramienta está instalada
- **THEN** VS Code se abre con la carpeta del proyecto como raíz de trabajo

#### Scenario: VS Code no disponible

- **WHEN** la app no encuentra VS Code en el sistema
- **THEN** la acción aparece deshabilitada y una ayuda indica que VS Code no está instalado

### Requirement: Abrir una terminal en la ruta

La acción "Abrir terminal" DEBE (SHALL) abrir una terminal del sistema con el directorio de trabajo inicial igual a la ruta del proyecto. Si ninguna terminal compatible está disponible, la acción DEBE aparecer deshabilitada con una explicación.

#### Scenario: Terminal disponible

- **WHEN** el usuario elige "Abrir terminal" en un proyecto con ruta existente
- **THEN** se abre una terminal cuyo directorio inicial es la carpeta del proyecto

#### Scenario: Ninguna terminal compatible

- **WHEN** la app no encuentra una terminal compatible en el sistema
- **THEN** la acción aparece deshabilitada y una ayuda explica que no se detectó ninguna terminal

### Requirement: Manejo de errores de apertura

Si una acción de apertura no puede ejecutarse, la app DEBE (SHALL) mostrar un mensaje que identifique la acción y el motivo, DEBE cerrar el menú y DEBE permanecer operativa sin cerrarse ni perder datos.

#### Scenario: Falla al lanzar una herramienta

- **WHEN** el sistema rechaza el lanzamiento del gestor de archivos, VS Code o la terminal
- **THEN** la app muestra un aviso con la acción fallida y el motivo, y el usuario puede seguir usando el catálogo

### Requirement: Ejecución segura de acciones

Las acciones DEBEN (SHALL) ejecutarse sin interpretar la ruta como código de shell: la ruta DEBE pasarse como un único argumento y solo DEBEN permitirse las acciones predefinidas de apertura. Una ruta con espacios, comillas o caracteres especiales NO DEBE provocar la ejecución de comandos adicionales.

#### Scenario: Ruta con espacios y caracteres especiales

- **WHEN** el usuario abre un proyecto cuya ruta contiene espacios, comillas o caracteres como `;`, `$` o `&`
- **THEN** la herramienta se abre exactamente en esa ruta y no se ejecuta ningún comando adicional

#### Scenario: Acción no permitida

- **WHEN** la interfaz solicita una acción distinta de abrir carpeta, abrir en VS Code o abrir terminal
- **THEN** la app rechaza la solicitud y no ejecuta ningún proceso
