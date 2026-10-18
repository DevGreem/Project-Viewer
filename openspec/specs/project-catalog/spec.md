# project-catalog Specification

## Purpose

Gestiona el catálogo local de proyectos del usuario: alta, edición, cierre, restauración, eliminación, portada y persistencia en disco.

## Requirements

### Requirement: Alta de proyectos

El usuario DEBE (SHALL) poder crear un proyecto desde la ventana principal indicando un nombre obligatorio y, opcionalmente, una ruta local, una imagen de portada y preferencias de editor/terminal. Al guardarlo, el sistema DEBE asignarle un identificador estable, marcarlo como activo y persistirlo en el catálogo local.

#### Scenario: Crear un proyecto con nombre, ruta y portada

- **WHEN** el usuario envía el formulario con un nombre válido, una ruta existente y una portada admitida
- **THEN** el proyecto aparece como activo en la grilla y queda guardado en el catálogo local

#### Scenario: Crear un proyecto sin ruta local

- **WHEN** el usuario guarda un proyecto indicando solo el nombre
- **THEN** el proyecto se crea como activo, se muestra con la indicación "Sin ruta" y las acciones de apertura quedan deshabilitadas

#### Scenario: Rechazar un nombre vacío

- **WHEN** el usuario intenta guardar un proyecto con un nombre vacío o compuesto solo por espacios
- **THEN** la app muestra un error de validación y no crea ningún registro

### Requirement: Edición de proyectos

El usuario DEBE (SHALL) poder editar el nombre, la ruta local, la portada y las preferencias de editor/terminal de cualquier proyecto existente. Los cambios DEBEN persistir y reflejarse de inmediato en la grilla; al reemplazar o quitar la portada, el sistema DEBE eliminar la copia anterior.

#### Scenario: Editar los datos de un proyecto

- **WHEN** el usuario modifica el nombre y la ruta de un proyecto y guarda los cambios
- **THEN** la tarjeta muestra los nuevos datos y, tras reiniciar la app, los cambios siguen presentes

#### Scenario: Quitar la portada

- **WHEN** el usuario elimina la portada de un proyecto que tenía una imagen
- **THEN** la tarjeta muestra el marcador visual por defecto y la copia anterior de la imagen deja de existir en el directorio de datos

### Requirement: Preferencias de lanzadores por proyecto

Cada proyecto DEBE (SHALL) poder guardar un override opcional de editor y otro de terminal, o heredar los valores globales. La preferencia DEBE persistir con el proyecto y los proyectos existentes DEBEN cargarse como «Heredar» sin migración manual.

#### Scenario: Crear un proyecto con editor y terminal propios

- **WHEN** el usuario crea un proyecto y elige Godot como editor y GNOME Terminal como terminal
- **THEN** el proyecto guarda ambos overrides y los usa en lugar de los valores globales

#### Scenario: Proyecto existente sin overrides

- **WHEN** la app carga un proyecto creado antes de existir esta función
- **THEN** el proyecto se interpreta como «Heredar» y usa los lanzadores globales

#### Scenario: Editar los overrides

- **WHEN** el usuario cambia el editor del proyecto de VS Code a Godot y guarda
- **THEN** el override persiste tras reiniciar la app y la acción de editor usa Godot

#### Scenario: Guardar una herramienta no detectada

- **WHEN** el usuario guarda un editor o terminal que no está instalado
- **THEN** la preferencia se conserva con una advertencia y la acción queda deshabilitada hasta que la herramienta esté disponible

### Requirement: Validación de la ruta local

Cuando se indique una ruta local, el sistema DEBE (SHALL) exigir que sea una ruta absoluta existente y que apunte a un directorio. Si no cumple, DEBE rechazar el guardado con un mensaje claro y no modificar el proyecto.

#### Scenario: Rechazar una ruta relativa

- **WHEN** el usuario intenta guardar una ruta relativa como `./mi-proyecto`
- **THEN** la app muestra un error que explica que la ruta debe ser absoluta y no guarda el cambio

#### Scenario: Rechazar una ruta inexistente o que no es un directorio

- **WHEN** el usuario indica una ruta que no existe o que apunta a un archivo
- **THEN** la app muestra un error y conserva los datos anteriores del proyecto

### Requirement: Unicidad de ruta entre proyectos activos

El sistema DEBE (SHALL) impedir que dos proyectos activos compartan la misma ruta local normalizada y DEBE explicar el conflicto al usuario. La misma ruta DEBE poder reutilizarse cuando el proyecto que la ocupaba está archivado.

#### Scenario: Impedir una ruta duplicada

- **WHEN** el usuario intenta guardar un segundo proyecto activo con una ruta ya usada por otro proyecto activo
- **THEN** la app rechaza el guardado e indica qué proyecto ya usa esa ruta

#### Scenario: Reutilizar la ruta de un proyecto archivado

- **WHEN** el usuario crea un proyecto con la ruta de un proyecto que está archivado
- **THEN** la app permite el alta sin conflicto

### Requirement: Portada del proyecto

El sistema DEBE (SHALL) aceptar portadas PNG, JPEG, WebP o GIF de hasta 5 MB, validando el contenido real del archivo. DEBE copiarlas al directorio de datos de la app y mostrar un marcador visual cuando no haya portada o la imagen no pueda leerse.

#### Scenario: Aceptar una portada válida

- **WHEN** el usuario elige una imagen PNG de 2 MB
- **THEN** la app copia la imagen al directorio de datos, la muestra en la tarjeta y guarda la referencia en el catálogo

#### Scenario: Rechazar un formato o tamaño no admitido

- **WHEN** el usuario elige un SVG, un archivo que no es una imagen o una imagen de más de 5 MB
- **THEN** la app rechaza la selección con un mensaje y conserva la portada anterior

### Requirement: Cierre y restauración

El usuario DEBE (SHALL) poder cerrar un proyecto activo para ocultarlo de la grilla sin borrar sus datos, y restaurarlo después desde la vista de archivados. Cerrar y restaurar DEBEN conservar nombre, ruta, portada y fechas.

#### Scenario: Cerrar un proyecto

- **WHEN** el usuario elige "Cerrar proyecto" en una tarjeta
- **THEN** el proyecto desaparece de la grilla de activos, aparece en archivados y conserva todos sus datos tras reiniciar la app

#### Scenario: Restaurar un proyecto archivado

- **WHEN** el usuario elige "Restaurar" en un proyecto archivado
- **THEN** el proyecto vuelve a la grilla de activos con su nombre, ruta y portada intactos

### Requirement: Eliminación definitiva

El usuario DEBE (SHALL) poder eliminar definitivamente un proyecto archivado tras una confirmación explícita. La eliminación DEBE borrar su registro y su copia de portada, y no DEBE afectar a la carpeta local referenciada.

#### Scenario: Eliminar un proyecto con confirmación

- **WHEN** el usuario confirma la eliminación de un proyecto archivado
- **THEN** el registro y la copia de su portada se borran, y la carpeta local del proyecto sigue existiendo

#### Scenario: Cancelar la eliminación

- **WHEN** el usuario cierra el diálogo de confirmación sin aceptar
- **THEN** el proyecto archivado permanece sin cambios

### Requirement: Persistencia y recuperación del catálogo

El catálogo DEBE (SHALL) guardarse en disco de forma atómica y sobrevivir al reinicio de la app. Si el archivo está corrupto o no puede leerse, la app DEBE iniciar con un catálogo vacío, conservar una copia del archivo dañado e informar al usuario.

#### Scenario: Conservar los proyectos tras reiniciar

- **WHEN** el usuario cierra y vuelve a abrir la app
- **THEN** la grilla y la vista de archivados muestran los mismos proyectos, estados y portadas

#### Scenario: Recuperarse de un catálogo corrupto

- **WHEN** la app encuentra un archivo de catálogo con JSON inválido al iniciar
- **THEN** muestra un catálogo vacío con un aviso, conserva el archivo dañado como respaldo y permite seguir usando la app
