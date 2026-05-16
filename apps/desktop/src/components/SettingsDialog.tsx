import { useEffect, useState } from 'react';
import { Cpu, DollarSign, FileDown, FolderCode, Link2, Trash2 } from 'lucide-react';
import { Button, Dialog, Input } from '@kay-am/ui';
import { ProvidersPanel } from './ProvidersPanel';
import { BudgetRulesPanel } from '../features/budget/components/BudgetRulesPanel';
import { GithubPanel } from '../features/github/components/Panel';
import { ImportConfigDialog } from './ImportConfigDialog';
import type { ConfigBundleImportResult } from '@kay-am/types';
import { DEFAULT_EDITOR_BINARY, SETTING_EDITOR_BINARY } from '../features/settings/settings';
import { SESSION_FEATURES } from '../shared/lib/features';
import { formatError } from '../shared/lib/errors';
import { useAppStore } from '../store';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  initialSection?: string;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type NavSection = 'app' | 'providers' | 'budget' | 'integrations' | 'initialization' | 'advanced';

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ReactNode;
  beta?: boolean;
}

// global settings only — per-workspace skills + workflows live in
// WorkspaceSettingsDialog (the gear icon next to a workspace row).
const NAV_ITEMS: NavItem[] = [
  { id: 'app', label: 'App', icon: <FolderCode size={14} aria-hidden /> },
  { id: 'providers', label: 'Providers', icon: <Cpu size={14} aria-hidden /> },
  ...(SESSION_FEATURES.budget
    ? [
        {
          id: 'budget' as const,
          label: 'Budget',
          icon: <DollarSign size={14} aria-hidden />,
          beta: true,
        },
      ]
    : []),
  { id: 'integrations', label: 'Integrations', icon: <Link2 size={14} aria-hidden /> },
  { id: 'initialization', label: 'Initialization', icon: <Trash2 size={14} aria-hidden /> },
  { id: 'advanced', label: 'Advanced', icon: <FileDown size={14} aria-hidden /> },
];

function isNavSection(value: string | undefined): value is NavSection {
  return (
    value === 'app' ||
    value === 'providers' ||
    value === 'budget' ||
    value === 'integrations' ||
    value === 'initialization' ||
    value === 'advanced'
  );
}

function BetaChip() {
  return (
    <span className="ml-auto rounded-sm bg-warning/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-warning">
      beta
    </span>
  );
}

export function SettingsDialog({ open, onClose, initialSection }: SettingsDialogProps) {
  const loadSetting = useAppStore((s) => s.loadSetting);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const exportConfig = useAppStore((s) => s.exportConfig);
  const importConfig = useAppStore((s) => s.importConfig);
  const wipeLocalDatabase = useAppStore((s) => s.wipeLocalDatabase);

  const [activeSection, setActiveSection] = useState<NavSection>('providers');
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
    if (!open) return;
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
      if (!result) return;
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
          <div className="flex flex-col gap-4">
            <SectionHeading>App settings</SectionHeading>
            <Field label="Default editor binary" help={`Launched as: \`${editorBinary} <path>\``}>
              <Input
                value={editorBinary}
                onChange={(e) => setEditorBinary(e.target.value)}
                placeholder={DEFAULT_EDITOR_BINARY}
              />
            </Field>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Workspace-specific defaults (branch prefix, skills, workflows) live in the gear icon
              next to each workspace row.
            </p>
          </div>
        );
      case 'providers':
        return <ProvidersPanel />;
      case 'budget':
        return <BudgetRulesPanel />;
      case 'integrations':
        return <GithubPanel />;
      case 'initialization':
        return (
          <div className="flex flex-col gap-4">
            <SectionHeading>Initialization</SectionHeading>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Wipe the local sqlite database — drops every workspace, session, agent, message,
              transcript, telemetry record, budget rule, permission rule, and skill registration.
              API keys in the OS keychain are not touched. Fresh schema is recreated on next boot.
            </p>
            {wipeError ? (
              <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                {wipeError}
              </p>
            ) : null}
            {wipeState === 'done' ? (
              <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
                Database wiped. Restart the app (or just reopen settings) to start fresh.
              </p>
            ) : null}
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
          <div className="flex flex-col gap-4">
            <SectionHeading>Config backup</SectionHeading>
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
      description="Configure providers, editor, and workspace defaults."
      size="xl"
      fixedHeightClass="h-[640px]"
      fullScreenOnSmall
      footer={
        <>
          {saveState === 'saved' ? (
            <span className="mr-auto text-xs text-success">Saved.</span>
          ) : null}
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
    >
      <div className="flex h-full min-h-0 gap-0">
        <nav className="flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto pr-2">
          {NAV_ITEMS.filter((item) => item.id !== 'initialization').map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={`relative flex items-center gap-2 rounded-md py-1.5 pl-3 pr-2 text-left text-sm transition-colors ${
                activeSection === item.id
                  ? 'bg-muted font-medium text-foreground before:absolute before:left-1 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-primary'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
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
                className={`relative flex w-full items-center gap-2 rounded-md py-1.5 pl-3 pr-2 text-left text-sm transition-colors ${
                  activeSection === item.id
                    ? 'bg-danger/15 font-medium text-danger before:absolute before:left-1 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-danger'
                    : 'text-danger/80 hover:bg-danger/10 hover:text-danger'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
        <div className="min-w-0 flex-1 overflow-y-auto pl-4">{renderContent()}</div>
      </div>

      <ImportConfigDialog
        open={importDialogOpen}
        result={importResult}
        error={importError}
        onClose={() => setImportDialogOpen(false)}
      />
    </Dialog>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold tracking-wide text-muted-foreground">{children}</div>
  );
}

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
