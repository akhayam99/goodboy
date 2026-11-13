import { DEFAULT_EDITOR_BINARY, SETTING_EDITOR_BINARY } from '../../features/settings/settings';

type Settings = Readonly<Record<string, string>>;

type ResolveEditorBinaryParams = {
  readonly settings: Settings;
};

export const resolveEditorBinary = ({ settings }: ResolveEditorBinaryParams): string =>
  settings[SETTING_EDITOR_BINARY] ?? DEFAULT_EDITOR_BINARY;
