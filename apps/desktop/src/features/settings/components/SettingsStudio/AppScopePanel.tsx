import { useEffect, useRef, useState } from 'react';
import { DollarSign, RotateCcw } from 'lucide-react';
import { Button, cn, FieldRow, KbdPill, ScrollFade, Select } from '@goodboy/ui';
import { GithubPanel } from '../../../../features/github/components/Panel';
import { ImportConfigDialog } from '../ImportConfigDialog';
import type { ConfigBundleImportResult } from '@goodboy/types';
import {
  DEFAULT_EDITOR_BINARY,
  SETTING_EDITOR_BINARY,
} from '../../../../features/settings/settings';
import { SESSION_FEATURES } from '../../../../shared/lib/features';
import { reopenWizard } from '../../../onboarding/onboarding-store';
import { formatError } from '../../../../shared/lib/errors';
import { useToast } from '../../../../app/components/Toast';
import { useAppStore } from '../../../../store';

type Props = {
  readonly initialSection?: string;
  readonly requestClose: () => void;
  readonly registerScrollTo?: (fn: (id: string) => void) => void;
};

const SHORTCUTS: ReadonlyArray<{ readonly combo: readonly string[]; readonly label: string }> = [
  { combo: ['⌘', 'K'], label: 'command palette' },
  { combo: ['⌘', 'N'], label: 'new session' },
  { combo: ['⌘', '1', '..', '9'], label: 'jump to workspace 1 to 9' },
  { combo: ['⌘', '['], label: 'back (lens history)' },
  { combo: ['⌘', ']'], label: 'forward (lens history)' },
  { combo: ['⌘', '⇧', '['], label: 'previous session' },
  { combo: ['⌘', '⇧', ']'], label: 'next session' },
  { combo: ['⌘', 'B'], label: 'toggle sidebar' },
  { combo: ['⌘', '⇧', 'K'], label: 'open model picker' },
  { combo: ['⌘', '⇧', 'P'], label: 'open permission picker' },
  { combo: ['⌘', '↵'], label: 'send message (queue if running)' },
  { combo: ['⌘', '⇧', 'A'], label: 'archive current session' },
  { combo: ['⌘', '.'], label: 'delete current session' },
  { combo: ['⌘', ','], label: 'open settings' },
  { combo: ['⌘', '/'], label: 'keyboard shortcuts' },
  { combo: ['Esc'], label: 'close dialog or cancel' },
];

export const AppScopePanel = ({ initialSection, requestClose, registerScrollTo }: Props) => {
  const loadSetting = useAppStore((s) => s.loadSetting);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const exportConfig = useAppStore((s) => s.exportConfig);
  const importConfig = useAppStore((s) => s.importConfig);
  const wipeLocalDatabase = useAppStore((s) => s.wipeLocalDatabase);
  const loadDetectedEditors = useAppStore((s) => s.loadDetectedEditors);
  const detectedEditors = useAppStore((s) => s.detectedEditors);
  const { showToast } = useToast();

  const [editorBinary, setEditorBinary] = useState(DEFAULT_EDITOR_BINARY);

  useEffect(() => {
    if (detectedEditors.length === 0) {
      void loadDetectedEditors();
    }
  }, []);
  const [exportState, setExportState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<ConfigBundleImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [wipeState, setWipeState] = useState<'idle' | 'confirm' | 'wiping' | 'done' | 'error'>(
    'idle',
  );
  const [wipeError, setWipeError] = useState<string | null>(null);

  const anchorsRef = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    void loadSetting(SETTING_EDITOR_BINARY).then((v) =>
      setEditorBinary(v ?? DEFAULT_EDITOR_BINARY),
    );
  }, [loadSetting]);

  useEffect(() => {
    if (!initialSection) {
      return;
    }
    anchorsRef.current[initialSection]?.scrollIntoView({ block: 'start' });
  }, [initialSection]);

  useEffect(() => {
    registerScrollTo?.((id) =>
      anchorsRef.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }, [registerScrollTo]);

  const onExport = async () => {
    setExportState('busy');
    try {
      const path = await exportConfig();
      setExportState(path ? 'done' : 'idle');
    } catch (err) {
      setExportState('error');
      showToast('error', formatError(err));
    }
  };

  const onImport = async () => {
    setImportResult(null);
    setImportError(null);
    try {
      const result = await importConfig();
      if (!result) {
        return;
      }
      setImportResult(result);
      setImportDialogOpen(true);
    } catch (err) {
      setImportError(formatError(err));
      setImportDialogOpen(true);
    }
  };

  const onChangeEditor = async (binary: string) => {
    setEditorBinary(binary);
    try {
      await saveSetting(SETTING_EDITOR_BINARY, binary || DEFAULT_EDITOR_BINARY);
      showToast('success', 'default editor saved');
    } catch (err) {
      showToast('error', formatError(err));
    }
  };

  const onWipe = async () => {
    setWipeState('wiping');
    setWipeError(null);
    try {
      await wipeLocalDatabase();
      setWipeState('done');
    } catch (err) {
      setWipeState('error');
      setWipeError(formatError(err));
    }
  };

  const editorOptions = detectedEditors.some((ed) => ed.binary === editorBinary)
    ? detectedEditors
    : [...detectedEditors, { binary: editorBinary, label: editorBinary }];

  const anchor = (id: string) => (el: HTMLDivElement | null) => {
    anchorsRef.current[id] = el;
  };

  return (
    <ScrollFade className="h-full w-full" viewportClassName="px-5 py-5">
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <div className="flex flex-col divide-y divide-border-soft/50">
          <div ref={anchor('editor')} className="py-4 first:pt-0 last:pb-0">
            <FieldRow label="Default editor" help="Opens session worktrees.">
              <Select
                size="sm"
                value={editorBinary}
                onChange={(e) => void onChangeEditor(e.target.value)}
                aria-label="default editor"
              >
                {editorOptions.map((ed) => (
                  <option key={ed.binary} value={ed.binary}>
                    {ed.label}
                  </option>
                ))}
              </Select>
            </FieldRow>

            <FieldRow label="Setup guide" help="Replay the first-run walkthrough.">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  requestClose();
                  reopenWizard();
                }}
              >
                <RotateCcw size={14} aria-hidden /> Run setup again
              </Button>
            </FieldRow>
          </div>

          {SESSION_FEATURES.budget ? (
            <div ref={anchor('budget')} className="py-4 first:pt-0 last:pb-0">
              <FieldRow label="Budget" help="Spend, caps, and alerts live in Budget Studio.">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    requestClose();
                    window.dispatchEvent(new CustomEvent('goodboy:open-budget-studio'));
                  }}
                >
                  <DollarSign size={14} aria-hidden /> Open Budget Studio
                </Button>
              </FieldRow>
            </div>
          ) : null}

          <div ref={anchor('shortcuts')} className="py-4 first:pt-0 last:pb-0">
            <FieldRow label="Keyboard shortcuts" layout="stacked">
              <ul className="grid grid-cols-2 gap-x-10">
                {SHORTCUTS.map((s) => (
                  <li key={s.label} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="flex items-center gap-0.5">
                      {s.combo.map((k) => (
                        <KbdPill key={k}>{k}</KbdPill>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </FieldRow>
          </div>

          <div ref={anchor('integrations')} className="py-4 first:pt-0 last:pb-0">
            <FieldRow label="GitHub" layout="stacked">
              <GithubPanel hideSectionHeader />
            </FieldRow>
          </div>

          <div ref={anchor('advanced')} className="py-4 first:pt-0 last:pb-0">
            <FieldRow
              label="Config backup"
              help="Export or import workspaces, skills, workflows, rules, and settings as JSON. API keys are never included."
            >
              <span className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void onExport()}
                  disabled={exportState === 'busy'}
                  className={exportState === 'busy' ? 'animate-border-pulse' : undefined}
                >
                  {exportState === 'busy'
                    ? 'Exporting…'
                    : exportState === 'done'
                      ? 'Exported'
                      : 'Export'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => void onImport()}>
                  Import
                </Button>
              </span>
            </FieldRow>
          </div>

          <div ref={anchor('initialization')} className="py-4 first:pt-0 last:pb-0">
            <FieldRow
              label="Wipe local database"
              help="Every workspace, session, transcript, and rule. Keychain keys are untouched. Fresh schema on next boot."
            >
              {wipeState === 'done' ? (
                <span className="text-xs text-success">Wiped. Restart the app to start fresh.</span>
              ) : wipeState === 'confirm' || wipeState === 'wiping' ? (
                <span className="flex items-center gap-2 rounded-md bg-danger/5 px-2 py-1.5">
                  <span className="text-xs font-medium text-danger">Irreversible.</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setWipeState('idle')}
                    disabled={wipeState === 'wiping'}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void onWipe()}
                    disabled={wipeState === 'wiping'}
                    className={cn(
                      'text-danger',
                      wipeState === 'wiping' && 'animate-border-pulse spin-border-danger',
                    )}
                  >
                    {wipeState === 'wiping' ? 'Wiping…' : 'Confirm'}
                  </Button>
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWipeState('confirm')}
                  className="text-danger hover:bg-danger/10 hover:text-danger"
                >
                  Wipe
                </Button>
              )}
            </FieldRow>
            {wipeError ? <p className="pt-2 text-xs text-danger">{wipeError}</p> : null}
          </div>
        </div>
      </div>

      <ImportConfigDialog
        open={importDialogOpen}
        result={importResult}
        error={importError}
        onClose={() => setImportDialogOpen(false)}
      />
    </ScrollFade>
  );
};
