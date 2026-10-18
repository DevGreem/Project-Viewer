# Spec Delta

## Purpose

Presenta una ventana compacta con la grilla de proyectos activos y las entradas para crear, editar, cerrar y consultar proyectos archivados.

## ADDED Requirements

### Requirement: Ventana principal de inicio

Al iniciarse, la app DEBE (SHALL) abrir una única ventana principal titulada "Project Viewer", centrada, redimensionable y con un tamaño inicial compacto (aproximadamente 960×640 px, mínimo 720×480 px) que muestre el panel de proyectos.

#### Scenario: Abrir la ventana al iniciar la app

- **WHEN** el usuario ejecuta la app manualmente
- **THEN** aparece una ventana visible con el panel de proyectos y la barra de título "Project Viewer"

#### Scenario: Redimensionar por debajo del mínimo

- **WHEN** el usuario intenta reducir la ventana por debajo de 720×480 px
- **THEN** la ventana conserva ese tamaño mínimo y el contenido sigue siendo utilizable

### Requirement: Grilla de proyectos activos

La ventana DEBE (SHALL) mostrar únicamente los proyectos activos en una grilla de tarjetas. Cada tarjeta DEBE incluir la portada o un marcador visual, el nombre y la ruta local (o la indicación "Sin ruta"), y la grilla DEBE adaptarse al ancho disponible con desplazamiento vertical cuando haya más proyectos de los que caben.

#### Scenario: Mostrar solo proyectos activos

- **WHEN** el catálogo contiene 10 proyectos activos y 2 archivados
- **THEN** la grilla muestra 10 tarjetas y ningún proyecto archivado

#### Scenario: Adaptar la grilla al ancho de la ventana

- **WHEN** el usuario reduce o amplía el ancho de la ventana
- **THEN** el número de columnas cambia sin cortar tarjetas y el exceso de contenido se recorre con desplazamiento vertical

#### Scenario: Truncar una ruta larga

- **WHEN** la ruta de un proyecto no cabe en la tarjeta
- **THEN** la ruta se muestra truncada y su valor completo está disponible al pasar el puntero o enfocar la tarjeta

### Requirement: Estado vacío

Cuando no exista ningún proyecto activo, la ventana DEBE (SHALL) mostrar un estado vacío explicativo con una acción principal para crear un proyecto y, si hay archivados, una referencia a la vista de archivados.

#### Scenario: Catálogo sin proyectos

- **WHEN** el usuario abre la app por primera vez sin proyectos guardados
- **THEN** ve un mensaje de bienvenida y un botón "Crear proyecto" que abre el formulario

#### Scenario: Sin activos pero con archivados

- **WHEN** todos los proyectos están archivados
- **THEN** el estado vacío indica que no hay proyectos activos y ofrece abrir la vista de archivados

### Requirement: Orden por actividad reciente

Los proyectos activos DEBEN (SHALL) ordenarse por fecha de última modificación de forma descendente, de modo que el proyecto editado o creado más recientemente aparezca primero.

#### Scenario: Mover al frente un proyecto editado

- **WHEN** el usuario edita un proyecto que estaba en la última posición de la grilla
- **THEN** ese proyecto pasa a la primera posición al guardar los cambios

### Requirement: Menú de acciones de la tarjeta

Cada tarjeta DEBE (SHALL) abrir un menú contextual al hacer clic en ella o en su botón de acciones. El menú DEBE incluir las acciones de apertura del proyecto, "Editar" y "Cerrar proyecto", y DEBE cerrarse con Escape o al hacer clic fuera de él.

#### Scenario: Abrir el menú de una tarjeta

- **WHEN** el usuario hace clic en una tarjeta de proyecto
- **THEN** aparece un menú con las acciones de apertura, edición y cierre del proyecto

#### Scenario: Cerrar el menú sin actuar

- **WHEN** el menú está abierto y el usuario pulsa Escape o hace clic fuera de él
- **THEN** el menú se cierra sin modificar el proyecto

### Requirement: Creación y edición en la misma ventana

La app DEBE (SHALL) crear y editar proyectos mediante un formulario modal dentro de la ventana principal, sin abrir ventanas adicionales. El formulario DEBE incluir nombre, ruta local y portada, con acciones de guardar y cancelar.

#### Scenario: Crear un proyecto desde la cabecera

- **WHEN** el usuario pulsa "Nuevo proyecto" y completa el formulario
- **THEN** el modal se cierra, la tarjeta nueva aparece primero en la grilla y la app sigue en la misma ventana

#### Scenario: Editar un proyecto desde su menú

- **WHEN** el usuario elige "Editar" en el menú de una tarjeta
- **THEN** se abre el formulario con los datos actuales precargados y, al guardar, la tarjeta refleja los cambios

#### Scenario: Cancelar el formulario

- **WHEN** el usuario pulsa "Cancelar" o Escape con cambios sin guardar
- **THEN** el formulario se cierra y el proyecto conserva sus datos anteriores

### Requirement: Vista de archivados

La ventana DEBE (SHALL) ofrecer una vista de proyectos archivados accesible desde la cabecera, con el número de archivados, y DEBE permitir restaurarlos o eliminarlos definitivamente desde allí sin alterar la grilla de activos.

#### Scenario: Abrir y cerrar la vista de archivados

- **WHEN** el usuario pulsa el botón de archivados y luego vuelve a la vista principal
- **THEN** ve los proyectos archivados con sus acciones y regresa a la grilla de activos sin perder el estado

#### Scenario: Restaurar desde archivados

- **WHEN** el usuario restaura un proyecto en la vista de archivados
- **THEN** el proyecto desaparece de esa vista y se incorpora a la grilla de activos

### Requirement: Carga y error del catálogo

Mientras lee el catálogo local, la app DEBE (SHALL) mostrar un indicador de carga. Si la lectura falla, DEBE mostrar un mensaje de error comprensible con una acción para reintentar, sin dejar la ventana en blanco ni bloquear el resto de la interfaz.

#### Scenario: Mostrar carga al iniciar

- **WHEN** la app está leyendo el catálogo al arrancar
- **THEN** muestra un indicador de carga hasta que la grilla o el estado vacío están listos

#### Scenario: Reintentar tras un error de lectura

- **WHEN** falla la lectura del catálogo y el usuario pulsa "Reintentar"
- **THEN** la app vuelve a intentar la lectura y muestra la grilla o un nuevo mensaje de error

### Requirement: Operación con teclado

Todos los controles de la ventana DEBEN (SHALL) ser alcanzables con Tab y activables con Enter o Espacio. El foco DEBE quedar atrapado dentro de los modales mientras estén abiertos y volver al elemento que los abrió al cerrarse.

#### Scenario: Navegar la grilla con teclado

- **WHEN** el usuario recorre la grilla con Tab y activa una tarjeta con Enter
- **THEN** se abre el menú de acciones de esa tarjeta y el foco se mueve al primer elemento del menú

#### Scenario: Cerrar un modal con Escape

- **WHEN** el formulario de proyecto está abierto y el usuario pulsa Escape
- **THEN** el modal se cierra y el foco vuelve al botón que lo abrió
