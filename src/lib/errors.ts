import type { AppError } from "../types";

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    typeof (value as AppError).code === "string" &&
    typeof (value as AppError).message === "string"
  );
}

const messages: Record<string, string> = {
  INVALID_NAME: "El nombre del proyecto no es válido.",
  INVALID_PATH:
    "La ruta local no es válida. Debe ser una carpeta existente y absoluta.",
  DUPLICATE_PATH: "Ya existe un proyecto activo con esa ruta local.",
  COVER_UNSUPPORTED: "La portada debe ser una imagen PNG, JPEG, WebP o GIF.",
  COVER_TOO_LARGE: "La portada no puede superar los 5 MB.",
  CATALOG_READ_FAILED: "No se pudo leer el catálogo de proyectos.",
  PROJECT_NOT_FOUND: "El proyecto ya no existe en el catálogo.",
  PROJECT_NOT_ARCHIVED: "Solo se pueden eliminar proyectos archivados.",
  PATH_UNAVAILABLE:
    "La carpeta del proyecto ya no está disponible. Edita su ruta local.",
  TOOL_NOT_FOUND: "No se encontró la herramienta necesaria en el sistema.",
  LAUNCHER_NOT_AVAILABLE:
    "El editor o la terminal configurados no están disponibles en el sistema.",
  INVALID_LAUNCHER_CONFIG:
    "La configuración del lanzador no es válida. Revisa el editor o la terminal.",
  INVALID_COMMAND_TEMPLATE:
    "El comando personalizado debe incluir {path} y tener comillas correctas.",
  SPAWN_FAILED: "No se pudo abrir la herramienta seleccionada.",
  INVALID_ACTION: "La acción solicitada no es válida.",
  AUTOSTART_FAILED: "No se pudo cambiar el arranque automático.",
  INTERNAL: "Ocurrió un error inesperado.",
};

export function errorMessage(error: unknown): string {
  if (isAppError(error)) {
    const base = messages[error.code] ?? error.message;
    if (error.details && (error.code === "DUPLICATE_PATH" || error.code === "TOOL_NOT_FOUND")) {
      return `${base} ${error.details}`;
    }
    return base;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
