import { useEffect, useState } from 'react';
import { DollarSign, FileDown, FolderCode, Keyboard, Link2, Sparkles, Trash2 } from 'lucide-react';
import { Button, Dialog, DialogSectionHeader, Input, KbdPill } from '@goodboy/ui';
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
import type { SaveState } from '../../../../shared/types/saveState';
import { useAppStore } from '../../../../store';

type Props = {
  open: boolean;
  onClose: () => void;
  initialSection?: string;
};

type NavSection = 'app' | 'shortcuts' | 'budget' | 'integrations' | 'initialization' | 'advanced';

type NavItem = {
  id: NavSection;
  label: string;
  icon: React.ReactNode;
  beta?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'app', label: 'App', icon: <FolderCode size={13} aria-hidden /> },
  { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={13} aria-hidden /> },
  ...(SESSION_FEATURES.budget
    ? [
        {
          id: 'budget' as const,
          label: 'Budget',
          icon: <DollarSign size={13} aria-hidden />,
          beta: true,
        },
      ]
    : []),
  { id: 'integrations', label: 'Integrations', icon: <Link2 size={13} aria-hidden /> },
  { id: 'initialization', label: 'Initialization', icon: <Trash2 size={13} aria-hidden /> },
  { id: 'advanced', label: 'Advanced', icon: <FileDown size={13} aria-hidden /> },
];

function isNavSection(value: string | undefined): value is NavSection {
  return (
    value === 'app' ||
    value === 'shortcuts' ||
    value === 'budget' ||
    value === 'integrations' ||
    value === 'initialization' ||
    value === 'advanced'
  );
}

const SHORTCUTS: ReadonlyArray<{ readonly combo: readonly string[]; readonly label: string }> = [
  { combo: ['⌘', 'K'], label: 'command palette' },
  { combo: ['⌘', 'N'], label: 'new session' },
  { combo: ['⌘', '1', '..', '9'], label: 'jump to workspace 1 to 9' },
  { combo: ['⌘', '['], label: 'previous session' },
  { combo: ['⌘', ']'], label: 'next session' },
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

function BetaChip() {
  return (
    <span className="ml-auto rounded-sm bg-warning/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-warning">
      beta
    </span>
  );
}

export const SettingsDialog = ({ open, onClose, initialSection }: Props) => {
  const loadSetting = useAppStore((s) => s.loadSetting);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const exportConfig = useAppStore((s) => s.exportConfig);
  const importConfig = useAppStore((s) => s.importConfig);
  const wipeLocalDatabase = useAppStore((s) => s.wipeLocalDatabase);

  const [activeSection, setActiveSection] = useState<NavSection>('app');
  const [editorBinary, setEditorBinary] = useState(DEFAULT_EDITOR_BINARY);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [exportState, setExportState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<ConfigBundleImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [wipeState, setWipeState] = useState<'idle' | 'confirm' | 'wiping' | 'done' | 'error'>(
    'idle',
  );
  const [wipeError, setWipeError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (isNavSection(initialSection)) {
      setActiveSection(initialSection);
    }
    setSaveState('idle');
    setError(null);
    void loadSetting(SETTING_EDITOR_BINARY).then((v) =>
      setEditorBinary(v ?? DEFAULT_EDITOR_BINARY),
    );
    setWipeState('idle');
    setWipeError(null);
  }, [open, loadSetting, initialSection]);

  const onExport = async () => {
    setExportState('busy');
    try {
      const path = await exportConfig();
      setExportState(path ? 'done' : 'idle');
    } catch (err) {
      setExportState('error');
      setError(formatError(err));
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

  const onSave = async () => {
    setSaveState('saving');
    setError(null);
    try {
      await saveSetting(SETTING_EDITOR_BINARY, editorBinary.trim() || DEFAULT_EDITOR_BINARY);
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setError(formatError(err));
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

  const needsSave = activeSection === 'app';

  const renderContent = () => {
    switch (activeSection) {
      case 'app':
        return (
          <div className="flex flex-col gap-6">
            <DialogSectionHeader
              icon={<FolderCode size={14} aria-hidden className="text-primary" />}
              title="App settings"
              description="Editor binary and first-run walkthrough. Workspace-specific defaults live in each workspace's gear."
            />
            <Field label="Default editor binary" help={`Launched as: \`${editorBinary} <path>\``}>
              <Input
                value={editorBinary}
                onChange={(e) => setEditorBinary(e.target.value)}
                placeholder={DEFAULT_EDITOR_BINARY}
              />
            </Field>
            <Field
              label="Setup guide"
              help="Replay the first-run walkthrough for providers and workspaces."
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onClose();
                  reopenWizard();
                }}
              >
                <Sparkles size={14} aria-hidden /> Run setup again
              </Button>
            </Field>
          </div>
        );
      case 'shortcuts':
        return (
          <div className="flex flex-col gap-6">
            <DialogSectionHeader
              icon={<Keyboard size={14} aria-hidden className="text-primary" />}
              title="Keyboard shortcuts"
              description="Global shortcuts active anywhere in Goodboy."
            />
            <ul className="flex flex-col divide-y divide-border-soft">
              {SHORTCUTS.map((s) => (
                <li key={s.label} className="flex items-center justify-between py-2 text-xs">
                  <span className="text-foreground">{s.label}</span>
                  <span className="flex items-center gap-0.5">
                    {s.combo.map((k) => (
                      <KbdPill key={k}>{k}</KbdPill>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      case 'budget':
        return (
          <div className="flex flex-col gap-6">
            <DialogSectionHeader
              icon={<DollarSign size={14} aria-hidden className="text-primary" />}
              title="Budget"
              description="Spend breakdowns, per-provider and per-session usage, and budget alerts now live in Budget Studio, a full-screen view with charts and live breakdowns across every session."
              beta
            />
            <Button
              onClick={() => {
                onClose();
                window.dispatchEvent(new CustomEvent('goodboy:open-budget-studio'));
              }}
            >
              <DollarSign size={14} aria-hidden /> Open Budget Studio
            </Button>
          </div>
        );
      case 'integrations':
        return <GithubPanel />;
      case 'initialization':
        return (
          <div className="flex flex-col gap-6">
            <DialogSectionHeader
              icon={<Trash2 size={14} aria-hidden className="text-danger" />}
              title="Initialization"
              description="Wipe the local sqlite database. Drops every workspace, session, agent, message, transcript, telemetry record, budget rule, permission rule, and skill registration. API keys in the OS keychain are not touched. Fresh schema is recreated on next boot."
              tone="danger"
            />
            {wipeError ? (
              <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                {wipeError}
              </p>
            ) : null}
            {wipeState === 'done' && (
              <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
                Database wiped. Restart the app (or reopen settings) to start fresh.
              </p>
            )}
            {wipeState === 'confirm' ? (
              <div className="flex flex-col gap-2 rounded-md border border-danger/40 bg-danger/5 p-3">
                <p className="text-sm font-semibold text-danger">
                  This is irreversible. Confirm wipe?
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setWipeState('idle')}>
                    Cancel
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => void onWipe()}>
                    Wipe database
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setWipeState('confirm')}
                  disabled={wipeState === 'wiping'}
                >
                  {wipeState === 'wiping' ? 'Wiping…' : 'Wipe local database'}
                </Button>
              </div>
            )}
          </div>
        );
      case 'advanced':
        return (
          <div className="flex flex-col gap-6">
            <DialogSectionHeader
              icon={<FileDown size={14} aria-hidden className="text-primary" />}
              title="Config backup"
              description="Export and import your Goodboy configuration. API keys are never included."
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void onExport()}
                disabled={exportState === 'busy'}
              >
                {exportState === 'busy'
                  ? 'Exporting…'
                  : exportState === 'done'
                    ? 'Exported ✓'
                    : 'Export config'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void onImport()}>
                Import config
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Export saves workspaces, skills, workflows, permission rules, budget rules, and
              settings to a JSON file. API keys are never included.
            </p>
          </div>
        );
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Settings"
      description="Editor, shortcuts, integrations, and workspace defaults."
      size="2xl"
      fixedHeightClass="h-[640px]"
      bodyClassName="px-0 py-0 gap-0"
      fullScreenOnSmall
      footer={
        <>
          {saveState === 'saved' && <span className="mr-auto text-xs text-success">Saved.</span>}
          {error ? <span className="mr-auto text-xs text-danger">{error}</span> : null}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {needsSave ? (
            <Button onClick={() => void onSave()} disabled={saveState === 'saving'}>
              {saveState === 'saving' ? 'Saving…' : 'Save'}
            </Button>
          ) : null}
        </>
      }
      panel={
        <>
          {NAV_ITEMS.filter((item) => item.id !== 'initialization').map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={`relative flex items-center gap-2 rounded-md py-2 pl-3 pr-2 text-left text-sm motion-safe:transition-colors ${
                activeSection === item.id
                  ? 'bg-background font-medium text-foreground shadow-sm before:absolute before:left-1 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-primary'
                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.beta ? <BetaChip /> : null}
            </button>
          ))}
          <div className="mt-auto pt-3">
            {NAV_ITEMS.filter((item) => item.id === 'initialization').map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`relative flex w-full items-center gap-2 rounded-md py-2 pl-3 pr-2 text-left text-sm motion-safe:transition-colors ${
                  activeSection === item.id
                    ? 'bg-danger/15 font-medium text-danger before:absolute before:left-1 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-danger'
                    : 'text-danger/80 hover:bg-danger/10 hover:text-danger'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </>
      }
    >
      <div className="min-w-0 flex-1 overflow-y-auto px-8 py-6">{renderContent()}</div>

      <ImportConfigDialog
        open={importDialogOpen}
        result={importResult}
        error={importError}
        onClose={() => setImportDialogOpen(false)}
      />
    </Dialog>
  );
};

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs font-semibold text-foreground">{label}</div>
      {children}
      {help ? <p className="text-xs leading-relaxed text-muted-foreground">{help}</p> : null}
    </div>
  );
}
