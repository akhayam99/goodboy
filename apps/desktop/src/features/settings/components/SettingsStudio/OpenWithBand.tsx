import { useEffect } from 'react';
import { Band, ICON_SIZE, Notice } from '@goodboy/ui';
import { Globe } from 'lucide-react';
import {
  DEFAULT_BROWSER_APP,
  DEFAULT_EDITOR_BINARY,
  DEFAULT_TERMINAL_APP,
  SETTING_BROWSER_APP,
  SETTING_EDITOR_BINARY,
  SETTING_TERMINAL_APP,
} from '../../settings';
import { useAppStore } from '../../../../store';

import { ownBrowserClickWord } from '../../../browser/ownBrowserClickWord';
import { useAppSettingSave } from '../../hooks/useAppSettingSave';
import { LinksOpenField } from './LinksOpenField';
import { ToolChoiceField, type ToolChoice } from './ToolChoiceField';

const EDITOR_HELP = 'Opens session worktrees.';
const TERMINAL_HELP = 'Opens projects, and runs provider commands.';

const BROWSER_LABELS: Readonly<Record<string, string>> = {
  safari: 'Safari',
  chrome: 'Chrome',
  arc: 'Arc',
  firefox: 'Firefox',
  edge: 'Edge',
  brave: 'Brave',
};

const EDITOR_LABELS: Readonly<Record<string, string>> = {
  code: 'VS Code',
  cursor: 'Cursor',
  webstorm: 'WebStorm',
  idea: 'IntelliJ IDEA',
  zed: 'Zed',
  subl: 'Sublime Text',
  vim: 'Vim',
  nvim: 'Neovim',
};

const TERMINAL_LABELS: Readonly<Record<string, string>> = {
  terminal: 'Terminal.app',
  iterm: 'iTerm',
  warp: 'Warp',
  ghostty: 'Ghostty',
};

const SYSTEM_BROWSER: ToolChoice = {
  value: DEFAULT_BROWSER_APP,
  label: 'System default',
  mark: <Globe size={ICON_SIZE.control} aria-hidden className="shrink-0" />,
};

export const OpenWithBand = () => {
  const loadSetting = useAppStore((s) => s.loadSetting);
  const loadDetectedEditors = useAppStore((s) => s.loadDetectedEditors);
  const loadDetectedBrowsers = useAppStore((s) => s.loadDetectedBrowsers);
  const loadDetectedTerminals = useAppStore((s) => s.loadDetectedTerminals);
  const detectedEditors = useAppStore((s) => s.detectedEditors);
  const detectedBrowsers = useAppStore((s) => s.detectedBrowsers);
  const detectedTerminals = useAppStore((s) => s.detectedTerminals);
  const storedEditor = useAppStore((s) => s.settings[SETTING_EDITOR_BINARY]);
  const storedBrowser = useAppStore((s) => s.settings[SETTING_BROWSER_APP]);
  const storedTerminal = useAppStore((s) => s.settings[SETTING_TERMINAL_APP]);
  const editorSave = useAppSettingSave({
    settingKey: SETTING_EDITOR_BINARY,
    saved: storedEditor ?? DEFAULT_EDITOR_BINARY,
    encode: ({ value }) => (value === '' ? DEFAULT_EDITOR_BINARY : value),
    display: ({ value }) =>
      detectedEditors.find((editor) => editor.binary === value)?.label ??
      EDITOR_LABELS[value] ??
      value,
    failureTitle: "Couldn't save the default editor",
  });
  const browserSave = useAppSettingSave({
    settingKey: SETTING_BROWSER_APP,
    saved: storedBrowser ?? DEFAULT_BROWSER_APP,
    encode: ({ value }) => (value === '' ? DEFAULT_BROWSER_APP : value),
    display: ({ value }) =>
      value === DEFAULT_BROWSER_APP ? SYSTEM_BROWSER.label : (BROWSER_LABELS[value] ?? value),
    failureTitle: "Couldn't save the default browser",
  });
  const terminalSave = useAppSettingSave({
    settingKey: SETTING_TERMINAL_APP,
    saved: storedTerminal ?? DEFAULT_TERMINAL_APP,
    encode: ({ value }) => (value === '' ? DEFAULT_TERMINAL_APP : value),
    display: ({ value }) => TERMINAL_LABELS[value] ?? value,
    failureTitle: "Couldn't save the default terminal app",
  });
  const editorBinary = editorSave.value;
  const browserApp = browserSave.value;
  const terminalApp = terminalSave.value;

  useEffect(() => {
    if (detectedEditors.length === 0) {
      void loadDetectedEditors();
    }
    void loadDetectedBrowsers();
    void loadDetectedTerminals();
  }, []);

  useEffect(() => {
    void loadSetting(SETTING_EDITOR_BINARY);
    void loadSetting(SETTING_BROWSER_APP);
    void loadSetting(SETTING_TERMINAL_APP);
  }, [loadSetting]);

  const editors = detectedEditors.some((ed) => ed.binary === editorBinary)
    ? detectedEditors
    : [
        ...detectedEditors,
        { binary: editorBinary, label: EDITOR_LABELS[editorBinary] ?? editorBinary },
      ];
  const editorChoices: ReadonlyArray<ToolChoice> = editors.map((editor) => ({
    value: editor.binary,
    label: editor.label,
  }));

  const terminals = detectedTerminals.some((terminal) => terminal.id === terminalApp)
    ? detectedTerminals
    : [
        ...detectedTerminals,
        {
          id: terminalApp,
          label: TERMINAL_LABELS[terminalApp] ?? terminalApp,
          canRunCommand: false,
        },
      ];
  const terminalChoices: ReadonlyArray<ToolChoice> = terminals.map((terminal) => ({
    value: terminal.id,
    label: terminal.label,
  }));

  const isBrowserMissing =
    browserApp !== DEFAULT_BROWSER_APP && !detectedBrowsers.some((b) => b.id === browserApp);
  const missingBrowserLabel = BROWSER_LABELS[browserApp] ?? browserApp;
  const browsers = isBrowserMissing
    ? [...detectedBrowsers, { id: browserApp, label: missingBrowserLabel }]
    : detectedBrowsers;
  const browserHelp = `Your browser, for links you ${ownBrowserClickWord()}, wireframes, and anything opened outside a session.`;
  const browserChoices: ReadonlyArray<ToolChoice> = [
    SYSTEM_BROWSER,
    ...browsers.map((browser) => ({
      value: browser.id,
      label: browser.label,
    })),
  ];

  return (
    <Band inset="content" label="Open with" headingLevel={2}>
      <div className="flex flex-col">
        <ToolChoiceField
          label="Editor"
          rowKey="open-editor"
          help={EDITOR_HELP}
          value={editorBinary}
          choices={editorChoices}
          save={editorSave}
          onChange={(binary) => void editorSave.save({ value: binary })}
        />
        <ToolChoiceField
          label="Terminal"
          rowKey="open-terminal"
          help={TERMINAL_HELP}
          value={terminalApp}
          defaultValue={DEFAULT_TERMINAL_APP}
          choices={terminalChoices}
          save={terminalSave}
          onChange={(id) => void terminalSave.save({ value: id })}
        />
        <ToolChoiceField
          label="Browser"
          rowKey="open-browser"
          help={browserHelp}
          value={browserApp}
          defaultValue={DEFAULT_BROWSER_APP}
          choices={browserChoices}
          save={browserSave}
          onChange={(id) => void browserSave.save({ value: id })}
        />
        {isBrowserMissing && (
          <Notice
            tone="warning"
            placement="inline"
            className="mt-2"
            title={`${missingBrowserLabel} isn't installed any more. Links open with your system browser until you pick another.`}
          />
        )}
        <LinksOpenField />
      </div>
    </Band>
  );
};
