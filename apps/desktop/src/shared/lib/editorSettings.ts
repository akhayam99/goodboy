import { DEFAULT_EDITOR_BINARY, SETTING_EDITOR_BINARY } from '../../features/settings/settings';
import type { ReportErrorParams } from '../../store/slices/notifications/reportError';
import { openInEditor } from './editor';

type Settings = Readonly<Record<string, string>>;

type ResolveEditorBinaryParams = {
  readonly settings: Settings;
};

type OpenInConfiguredEditorParams = {
  readonly path: string;
  readonly editor?: string;
  readonly state: {
    readonly settings: Settings;
    readonly reportError: (params: ReportErrorParams) => Promise<void> | void;
  };
};

export const resolveEditorBinary = ({ settings }: ResolveEditorBinaryParams): string =>
  settings[SETTING_EDITOR_BINARY] ?? DEFAULT_EDITOR_BINARY;

export const openInConfiguredEditor = async ({
  path,
  editor,
  state,
}: OpenInConfiguredEditorParams): Promise<void> => {
  try {
    await openInEditor({
      path,
      editor: editor ?? resolveEditorBinary({ settings: state.settings }),
    });
  } catch (error) {
    void state.reportError({ title: "Couldn't open the editor", error });
  }
};
