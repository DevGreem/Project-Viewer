import type {
  EditorChoice,
  EditorKind,
  LauncherAvailability,
  LauncherOption,
  TerminalChoice,
  TerminalKind,
} from "../types";

export const defaultEditor: EditorChoice = { kind: "auto", command: null };
export const defaultTerminal: TerminalChoice = {
  kind: "auto",
  command: null,
};

export const editorKinds: EditorKind[] = [
  "auto",
  "vscode",
  "godot",
  "custom",
];

export const terminalKinds: TerminalKind[] = [
  "auto",
  "gnome-terminal",
  "konsole",
  "xfce4-terminal",
  "kitty",
  "alacritty",
  "custom",
];

export const editorLabels: Record<EditorKind, string> = {
  auto: "Automático",
  vscode: "VS Code",
  godot: "Godot",
  custom: "Personalizado",
};

export const terminalLabels: Record<TerminalKind, string> = {
  auto: "Automático",
  "gnome-terminal": "GNOME Terminal",
  konsole: "Konsole",
  "xfce4-terminal": "Xfce Terminal",
  kitty: "kitty",
  alacritty: "Alacritty",
  custom: "Personalizado",
};

export const emptyAvailability: LauncherAvailability = {
  folder: false,
  editors: [],
  terminals: [],
};

export function findOption(
  options: LauncherOption[],
  kind: string,
): LauncherOption | undefined {
  return options.find((option) => option.id === kind);
}

export interface EffectiveLauncher {
  choice: EditorChoice | TerminalChoice | null;
  label: string;
  available: boolean;
}

type AnyChoice = EditorChoice | TerminalChoice;

export function effectiveEditor(
  projectEditor: EditorChoice | null | undefined,
  globalEditor: EditorChoice,
  availability: LauncherAvailability,
): EffectiveLauncher {
  return effectiveLauncher(
    projectEditor,
    globalEditor,
    availability.editors,
    editorLabels,
  );
}

export function effectiveTerminal(
  projectTerminal: TerminalChoice | null | undefined,
  globalTerminal: TerminalChoice,
  availability: LauncherAvailability,
): EffectiveLauncher {
  return effectiveLauncher(
    projectTerminal,
    globalTerminal,
    availability.terminals,
    terminalLabels,
  );
}

function effectiveLauncher(
  projectChoice: AnyChoice | null | undefined,
  globalChoice: AnyChoice,
  options: LauncherOption[],
  labels: Record<string, string>,
): EffectiveLauncher {
  const choice: AnyChoice = projectChoice ?? globalChoice;
  if (choice.kind === "auto") {
    const option = options.find(
      (candidate) => candidate.available && candidate.id !== "custom",
    );
    if (!option) {
      return {
        choice: null,
        label: labels.auto,
        available: false,
      };
    }
    return {
      choice: { kind: option.id, command: null } as AnyChoice,
      label: option.label,
      available: true,
    };
  }

  const option = findOption(options, choice.kind);
  return {
    choice,
    label: option?.label ?? labels[choice.kind] ?? "Personalizado",
    available: option?.available ?? choice.kind === "custom",
  };
}

export function editorChoiceForSelect(value: string): EditorChoice | null {
  if (value === "inherit") return null;
  return {
    kind: value as EditorKind,
    command: value === "custom" ? "" : null,
  };
}

export function terminalChoiceForSelect(value: string): TerminalChoice | null {
  if (value === "inherit") return null;
  return {
    kind: value as TerminalKind,
    command: value === "custom" ? "" : null,
  };
}

export function commandValidationError(
  choice: EditorChoice | TerminalChoice | null,
): string | null {
  if (!choice || choice.kind !== "custom") return null;
  const command = choice.command?.trim() ?? "";
  if (!command) {
    return "El comando personalizado no puede estar vacío.";
  }
  if (!command.includes("{path}")) {
    return "El comando personalizado debe incluir {path}.";
  }
  return null;
}
