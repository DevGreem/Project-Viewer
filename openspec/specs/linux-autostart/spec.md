# linux-autostart Specification

## Purpose

Integra la app con el inicio de sesión de Linux para mostrar el panel de proyectos automáticamente y evitar ventanas o instancias duplicadas.

## Requirements

### Requirement: Arranque automático al iniciar sesión

En la primera ejecución de la app empaquetada en Linux, el sistema DEBE (SHALL) registrar una entrada de autostart del usuario (XDG Autostart) que apunte al ejecutable actual y quede habilitada. En cada inicio de sesión posterior, la app DEBE abrir la ventana principal mostrando el panel de proyectos.

#### Scenario: Registrar el autostart en el primer arranque

- **WHEN** el usuario ejecuta por primera vez la app empaquetada
- **THEN** se crea una entrada de autostart habilitada en el directorio de configuración del usuario que apunta al ejecutable de la app

#### Scenario: Abrir la ventana al iniciar sesión

- **WHEN** el usuario inicia sesión en el escritorio con el autostart habilitado
- **THEN** la app arranca y muestra la ventana con la grilla de proyectos sin requerir una acción adicional

### Requirement: Preferencia de autostart

La app DEBE (SHALL) ofrecer un control para habilitar o deshabilitar el arranque automático. La preferencia DEBE persistir entre reinicios y DEBE reflejarse en la entrada de autostart del sistema.

#### Scenario: Deshabilitar el arranque automático

- **WHEN** el usuario desactiva la opción de iniciar al iniciar sesión
- **THEN** la entrada de autostart queda deshabilitada o se elimina, y en el siguiente inicio de sesión la app no se abre automáticamente

#### Scenario: Volver a habilitar el arranque automático

- **WHEN** el usuario activa de nuevo la opción
- **THEN** la entrada de autostart se restaura, la preferencia persiste y el arranque automático vuelve a funcionar en el siguiente inicio de sesión

### Requirement: Instancia única

La app DEBE (SHALL) permitir una sola instancia en ejecución. Si el usuario o el autostart intentan abrir una segunda instancia, el sistema DEBE enfocar y mostrar la ventana existente en lugar de crear otra.

#### Scenario: Segundo lanzamiento con la app abierta

- **WHEN** la app ya está en ejecución y el usuario la vuelve a abrir
- **THEN** no se crea una segunda ventana y la ventana existente se muestra y recibe el foco

#### Scenario: Autostart con una instancia previa

- **WHEN** el autostart se dispara mientras la app ya está ejecutándose
- **THEN** se conserva una sola ventana y no se duplican procesos visibles para el usuario

### Requirement: Entrada de autostart actualizada

La entrada de autostart DEBE (SHALL) apuntar siempre al ejecutable actual de la app. Si la ruta del ejecutable cambia por una actualización o reinstalación, la app DEBE actualizar la entrada en su siguiente arranque sin crear entradas duplicadas.

#### Scenario: Actualizar la ruta del ejecutable

- **WHEN** la app detecta que la entrada de autostart apunta a una ruta antigua
- **THEN** la reemplaza por la ruta del ejecutable actual y mantiene una sola entrada

### Requirement: Integración sin privilegios

La configuración de autostart DEBE (SHALL) realizarse en el directorio del usuario y NO DEBE requerir permisos de administrador ni modificar archivos del sistema.

#### Scenario: Registrar el autostart sin sudo

- **WHEN** un usuario sin privilegios habilita el arranque automático
- **THEN** la entrada se crea correctamente en su directorio de configuración sin solicitar contraseña ni permisos de root
