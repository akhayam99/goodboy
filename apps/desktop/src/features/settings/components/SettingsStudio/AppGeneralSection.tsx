import { useEffect, useState } from 'react';
import { FieldRow, Band, Listbox, type ListboxOption } from '@goodboy/ui';
import { Monitor, Moon, Sun } from 'lucide-react';
import {
  DEFAULT_EDITOR_BINARY,
  SETTING_EDITOR_BINARY,
} from '../../../../features/settings/settings';
import { useAppStore } from '../../../../store';
import { useThemeStore, type ThemePreference } from '../../../../shared/lib/theme';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { UpdatesSection } from './UpdatesSection';

const THEME_OPTIONS: ReadonlyArray<ListboxOption<ThemePreference>> = [
  { value: 'system', label: 'Match system', leading: <Monitor size={ICON_SIZE.row} /> },
  { value: 'light', label: 'Light', leading: <Sun size={ICON_SIZE.row} /> },
  { value: 'dark', label: 'Dark', leading: <Moon size={ICON_SIZE.row} /> },
];

export const AppGeneralSection = () => {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const loadSetting = useAppStore((s) => s.loadSetting);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const loadDetectedEditors = useAppStore((s) => s.loadDetectedEditors);
  const detectedEditors = useAppStore((s) => s.detectedEditors);
  const reportError = useAppStore((s) => s.reportError);
  const [editorBinary, setEditorBinary] = useState(DEFAULT_EDITOR_BINARY);

  useEffect(() => {
    if (detectedEditors.length === 0) {
      void loadDetectedEditors();
    }
  }, []);

  useEffect(() => {
    void loadSetting(SETTING_EDITOR_BINARY).then((v) =>
      setEditorBinary(v ?? DEFAULT_EDITOR_BINARY),
    );
  }, [loadSetting]);

  const onChangeEditor = async (binary: string) => {
    setEditorBinary(binary);
    try {
      await saveSetting(SETTING_EDITOR_BINARY, binary || DEFAULT_EDITOR_BINARY);
    } catch (err) {
      void reportError({ title: "Couldn't save the default editor", error: err });
    }
  };

  const editorOptions = detectedEditors.some((ed) => ed.binary === editorBinary)
    ? detectedEditors
    : [...detectedEditors, { binary: editorBinary, label: editorBinary }];

  return (
    <div className="flex flex-col gap-4">
      <UpdatesSection />

      <Band
        inset="content"
        label="Appearance"
        hint="How the app looks on this computer."
        icon={<CONCEPT_ICONS.appearance size={ICON_SIZE.row} aria-hidden />}
        headingLevel={2}
      >
        <div className="flex flex-col">
          <FieldRow label="Theme" help="Applies to every window.">
            <Listbox
              size="sm"
              value={preference}
              options={THEME_OPTIONS}
              onChange={setPreference}
              ariaLabel="Theme"
            />
          </FieldRow>
        </div>
      </Band>

      <Band
        inset="content"
        label="Editor"
        hint="How session worktrees open."
        icon={<CONCEPT_ICONS.editor size={ICON_SIZE.row} aria-hidden />}
        headingLevel={2}
      >
        <div className="flex flex-col">
          <FieldRow label="Default editor" help="Opens session worktrees.">
            <Listbox
              size="sm"
              value={editorBinary}
              options={editorOptions.map((editor) => ({
                value: editor.binary,
                label: editor.label,
              }))}
              onChange={(binary) => void onChangeEditor(binary)}
              ariaLabel="Default editor"
            />
          </FieldRow>
        </div>
      </Band>
    </div>
  );
};
