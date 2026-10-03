import { useEffect, useState } from 'react';
import { Band, Notice } from '@goodboy/ui';
import { Globe } from 'lucide-react';
import {
  DEFAULT_BROWSER_APP,
  DEFAULT_EDITOR_BINARY,
  SETTING_BROWSER_APP,
  SETTING_EDITOR_BINARY,
} from '../../settings';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ToolChoiceField, type ToolChoice } from './ToolChoiceField';
import { ToolMark } from './ToolMark';

const BROWSER_LABELS: Readonly<Record<string, string>> = {
  safari: 'Safari',
  chrome: 'Chrome',
  arc: 'Arc',
  firefox: 'Firefox',
  edge: 'Edge',
  brave: 'Brave',
};

const SYSTEM_BROWSER: ToolChoice = {
  value: DEFAULT_BROWSER_APP,
  label: 'System default',
  mark: <Globe size={ICON_SIZE.control} aria-hidden className="shrink-0" />,
};

export const OpenWithBand = () => {
  const loadSetting = useAppStore((s) => s.loadSetting);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const loadDetectedEditors = useAppStore((s) => s.loadDetectedEditors);
  const loadDetectedBrowsers = useAppStore((s) => s.loadDetectedBrowsers);
  const detectedEditors = useAppStore((s) => s.detectedEditors);
  const detectedBrowsers = useAppStore((s) => s.detectedBrowsers);
  const reportError = useAppStore((s) => s.reportError);
  const [editorBinary, setEditorBinary] = useState(DEFAULT_EDITOR_BINARY);
  const [browserApp, setBrowserApp] = useState(DEFAULT_BROWSER_APP);

  useEffect(() => {
    if (detectedEditors.length === 0) {
      void loadDetectedEditors();
    }
    void loadDetectedBrowsers();
  }, []);

  useEffect(() => {
    void loadSetting(SETTING_EDITOR_BINARY).then((v) =>
      setEditorBinary(v ?? DEFAULT_EDITOR_BINARY),
    );
    void loadSetting(SETTING_BROWSER_APP).then((v) => setBrowserApp(v ?? DEFAULT_BROWSER_APP));
  }, [loadSetting]);

  const onChangeEditor = async (binary: string) => {
    setEditorBinary(binary);
    try {
      await saveSetting(SETTING_EDITOR_BINARY, binary || DEFAULT_EDITOR_BINARY);
    } catch (err) {
      void reportError({ title: "Couldn't save the default editor", error: err });
    }
  };

  const onChangeBrowser = async (id: string) => {
    setBrowserApp(id);
    try {
      await saveSetting(SETTING_BROWSER_APP, id || DEFAULT_BROWSER_APP);
    } catch (err) {
      void reportError({ title: "Couldn't save the default browser", error: err });
    }
  };

  const editors = detectedEditors.some((ed) => ed.binary === editorBinary)
    ? detectedEditors
    : [...detectedEditors, { binary: editorBinary, label: editorBinary }];
  const editorChoices: ReadonlyArray<ToolChoice> = editors.map((editor) => ({
    value: editor.binary,
    label: editor.label,
    mark: <ToolMark name={editor.label} />,
  }));

  const isBrowserMissing =
    browserApp !== DEFAULT_BROWSER_APP && !detectedBrowsers.some((b) => b.id === browserApp);
  const missingBrowserLabel = BROWSER_LABELS[browserApp] ?? browserApp;
  const browsers = isBrowserMissing
    ? [...detectedBrowsers, { id: browserApp, label: missingBrowserLabel }]
    : detectedBrowsers;
  const browserChoices: ReadonlyArray<ToolChoice> = [
    SYSTEM_BROWSER,
    ...browsers.map((browser) => ({
      value: browser.id,
      label: browser.label,
      mark: <ToolMark name={browser.label} />,
    })),
  ];

  return (
    <Band
      inset="content"
      label="Open with"
      hint="Which tools open worktrees and links on this computer."
      icon={<CONCEPT_ICONS.editor size={ICON_SIZE.row} aria-hidden />}
      headingLevel={2}
    >
      <div className="flex flex-col">
        <ToolChoiceField
          label="Editor"
          help="Opens session worktrees."
          value={editorBinary}
          choices={editorChoices}
          onChange={(binary) => void onChangeEditor(binary)}
        />
        <ToolChoiceField
          label="Browser"
          help="Opens links, and artifacts you open in a browser."
          value={browserApp}
          choices={browserChoices}
          onChange={(id) => void onChangeBrowser(id)}
        />
        {isBrowserMissing && (
          <Notice
            tone="warning"
            placement="inline"
            className="mt-2"
            title={`${missingBrowserLabel} is not installed any more. Links open with your system browser until you pick another.`}
          />
        )}
      </div>
    </Band>
  );
};
