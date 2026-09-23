import { useEffect, useState } from 'react';
import { Divider, FieldRow, SectionHeader, Select } from '@goodboy/ui';
import {
  DEFAULT_EDITOR_BINARY,
  SETTING_EDITOR_BINARY,
} from '../../../../features/settings/settings';
import { useAppStore } from '../../../../store';
import { useThemeStore } from '../../../../shared/lib/theme';
import { UpdatesSection } from './UpdatesSection';

export const AppGeneralSection = () => {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
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
    <div className="flex flex-col gap-6">
      <UpdatesSection />

      <Divider />

      <section className="flex flex-col gap-4">
        <SectionHeader label="Appearance" hint="How the app looks on this computer." />
        <div className="flex flex-col">
          <FieldRow label="Theme" help="Applies to every window.">
            <Select
              size="sm"
              value={theme}
              onChange={(e) => setTheme(e.target.value === 'light' ? 'light' : 'dark')}
              aria-label="Theme"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </Select>
          </FieldRow>
        </div>
      </section>

      <Divider />

      <section className="flex flex-col gap-4">
        <SectionHeader label="Editor" hint="How session worktrees open." />
        <div className="flex flex-col">
          <FieldRow label="Default editor" help="Opens session worktrees.">
            <Select
              size="sm"
              value={editorBinary}
              onChange={(e) => void onChangeEditor(e.target.value)}
              aria-label="Default editor"
            >
              {editorOptions.map((editor) => (
                <option key={editor.binary} value={editor.binary}>
                  {editor.label}
                </option>
              ))}
            </Select>
          </FieldRow>
        </div>
      </section>
    </div>
  );
};
