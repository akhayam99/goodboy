import { useEffect, useState } from 'react';
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
import { LinksOpenField } from './LinksOpenField';
import { ToolChoiceField, type ToolChoice } from './ToolChoiceField';
import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';

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

type TerminalChoiceParams = {
  readonly id: string;
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
  const saveSetting = useAppStore((s) => s.saveSetting);
  const loadDetectedEditors = useAppStore((s) => s.loadDetectedEditors);
  const loadDetectedBrowsers = useAppStore((s) => s.loadDetectedBrowsers);
  const loadDetectedTerminals = useAppStore((s) => s.loadDetectedTerminals);
  const detectedEditors = useAppStore((s) => s.detectedEditors);
  const detectedBrowsers = useAppStore((s) => s.detectedBrowsers);
  const detectedTerminals = useAppStore((s) => s.detectedTerminals);
  const reportError = useAppStore((s) => s.reportError);
  const [editorBinary, setEditorBinary] = useState(DEFAULT_EDITOR_BINARY);
  const [browserApp, setBrowserApp] = useState(DEFAULT_BROWSER_APP);
  const [terminalApp, setTerminalApp] = useState(DEFAULT_TERMINAL_APP);

  useEffect(() => {
    if (detectedEditors.length === 0) {
      void loadDetectedEditors();
    }
    void loadDetectedBrowsers();
    void loadDetectedTerminals();
  }, []);

  useEffect(() => {
    void loadSetting(SETTING_EDITOR_BINARY).then((v) =>
      setEditorBinary(v ?? DEFAULT_EDITOR_BINARY),
    );
    void loadSetting(SETTING_BROWSER_APP).then((v) => setBrowserApp(v ?? DEFAULT_BROWSER_APP));
    void loadSetting(SETTING_TERMINAL_APP).then((v) => setTerminalApp(v ?? DEFAULT_TERMINAL_APP));
  }, [loadSetting]);

  const onChangeEditor = async (binary: string) => {
    setEditorBinary(binary);
    try {
      await saveSetting(SETTING_EDITOR_BINARY, binary || DEFAULT_EDITOR_BINARY);
    } catch (err) {
      void reportError({
        title: "Couldn't save the default editor",
        error: err,
        recovery: CHECK_STATE,
      });
    }
  };

  const onChangeBrowser = async (id: string) => {
    setBrowserApp(id);
    try {
      await saveSetting(SETTING_BROWSER_APP, id || DEFAULT_BROWSER_APP);
    } catch (err) {
      void reportError({
        title: "Couldn't save the default browser",
        error: err,
        recovery: CHECK_STATE,
      });
    }
  };

  const onChangeTerminal = async ({ id }: TerminalChoiceParams) => {
    setTerminalApp(id);
    try {
      await saveSetting(SETTING_TERMINAL_APP, id === '' ? DEFAULT_TERMINAL_APP : id);
    } catch (err) {
      void reportError({
        title: "Couldn't save the default terminal app",
        error: err,
        recovery: CHECK_STATE,
      });
    }
  };

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
          help="Opens session worktrees."
          value={editorBinary}
          choices={editorChoices}
          onChange={(binary) => void onChangeEditor(binary)}
        />
        <ToolChoiceField
          label="Terminal"
          help="Opens projects, and runs provider commands."
          value={terminalApp}
          choices={terminalChoices}
          onChange={(id) => void onChangeTerminal({ id })}
        />
        <ToolChoiceField
          label="Browser"
          help={`Your browser, for links you ${ownBrowserClickWord()}, wireframes, and anything opened outside a session.`}
          value={browserApp}
          choices={browserChoices}
          onChange={(id) => void onChangeBrowser(id)}
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
