import { useEffect, useState } from 'react';
import { Bot, Cpu, DollarSign, FileDown, FolderCode, Lock, Trash2 } from 'lucide-react';
import { Button, Dialog, Input } from '@kay-am/ui';
import { ProvidersPanel } from './ProvidersPanel';
import { BudgetRulesPanel } from './BudgetRulesPanel';
import { PermissionsPanel } from './PermissionsPanel';
import { ImportConfigDialog } from './ImportConfigDialog';
import type { ConfigBundleImportResult } from '@kay-am/types';
import {
  DEFAULT_EDITOR_BINARY,
  DEFAULT_ENABLE_PARALLEL_AGENTS,
  DEFAULT_MAX_PARALLELISM,
  MAX_PARALLELISM,
  MIN_PARALLELISM,
  SETTING_EDITOR_BINARY,
  SETTING_ENABLE_PARALLEL_AGENTS,
  SETTING_MAX_PARALLELISM,
} from '../settings';
import { useAppStore } from '../store';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  initialSection?: string;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type NavSection =
  | 'app'
  | 'providers'
  | 'budget'
  | 'agent'
  | 'permissions'
  | 'initialization'
  | 'advanced';

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ReactNode;
  beta?: boolean;
}

// global settings only — per-workspace skills + phase templates live in
// WorkspaceSettingsDialog (the gear icon next to a workspace row).
const NAV_ITEMS: NavItem[] = [
  { id: 'app', label: 'app', icon: <FolderCode size={14} aria-hidden /> },
  { id: 'providers', label: 'providers', icon: <Cpu size={14} aria-hidden /> },
  { id: 'budget', label: 'budget', icon: <DollarSign size={14} aria-hidden />, beta: true },
  { id: 'agent', label: 'agent', icon: <Bot size={14} aria-hidden />, beta: true },
  { id: 'permissions', label: 'permissions', icon: <Lock size={14} aria-hidden />, beta: true },
  { id: 'initialization', label: 'initialization', icon: <Trash2 size={14} aria-hidden /> },
  { id: 'advanced', label: 'advanced', icon: <FileDown size={14} aria-hidden /> },
];

function isNavSection(value: string | undefined): value is NavSection {
  return (
    value === 'app' ||
    value === 'providers' ||
    value === 'budget' ||
    value === 'agent' ||
    value === 'permissions' ||
    value === 'initialization' ||
    value === 'advanced'
  );
}

function BetaChip() {
  return (
    <span className="ml-auto rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600">
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
  const [enableParallelAgents, setEnableParallelAgents] = useState(DEFAULT_ENABLE_PARALLEL_AGENTS);
  const [maxParallelism, setMaxParallelism] = useState(DEFAULT_MAX_PARALLELISM);
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
    void loadSetting(SETTING_ENABLE_PARALLEL_AGENTS).then((v) =>
      setEnableParallelAgents(v === 'true'),
    );
    void loadSetting(SETTING_MAX_PARALLELISM).then((v) => {
      const parsed = v !== null ? parseInt(v, 10) : NaN;
      setMaxParallelism(
        !isNaN(parsed) && parsed >= MIN_PARALLELISM && parsed <= MAX_PARALLELISM
          ? parsed
          : DEFAULT_MAX_PARALLELISM,
      );
    });
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
      setError(err instanceof Error ? err.message : String(err));
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
      setImportError(err instanceof Error ? err.message : String(err));
      setImportDialogOpen(true);
    }
  };

  const onSave = async () => {
    setSaveState('saving');
    setError(null);
    try {
      await saveSetting(SETTING_EDITOR_BINARY, editorBinary.trim() || DEFAULT_EDITOR_BINARY);
      await saveSetting(SETTING_ENABLE_PARALLEL_AGENTS, enableParallelAgents ? 'true' : 'false');
      const clampedParallelism = Math.max(
        MIN_PARALLELISM,
        Math.min(MAX_PARALLELISM, maxParallelism),
      );
      await saveSetting(SETTING_MAX_PARALLELISM, String(clampedParallelism));
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setError(err instanceof Error ? err.message : String(err));
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
      setWipeError(err instanceof Error ? err.message : String(err));
    }
  };

  const needsSave = activeSection === 'app' || activeSection === 'agent';

  const renderContent = () => {
    switch (activeSection) {
      case 'app':
        return (
          <div className="flex flex-col gap-4">
            <SectionHeading>app settings</SectionHeading>
            <Field label="default editor binary" help={`launched as: \`${editorBinary} <path>\``}>
              <Input
                value={editorBinary}
                onChange={(e) => setEditorBinary(e.target.value)}
                placeholder={DEFAULT_EDITOR_BINARY}
              />
            </Field>
            <p className="text-xs leading-relaxed text-muted-foreground">
              workspace-specific defaults (branch prefix, skills, workflows) live in the gear icon
              next to each workspace row.
            </p>
          </div>
        );
      case 'providers':
        return <ProvidersPanel />;
      case 'budget':
        return <BudgetRulesPanel />;
      case 'agent':
        return (
          <div className="flex flex-col gap-4">
            <SectionHeading>agent settings</SectionHeading>
            <Field
              label="enable parallel agents"
              help="split-view transcript renders N columns when a parallel phase group is active."
            >
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer rounded border border-border accent-primary"
                  checked={enableParallelAgents}
                  onChange={(e) => setEnableParallelAgents(e.target.checked)}
                />
                <span className="text-sm text-foreground">
                  {enableParallelAgents ? 'on' : 'off'}
                </span>
              </label>
            </Field>
            <Field
              label="max parallelism"
              help={`number of concurrent agent columns (${MIN_PARALLELISM}–${MAX_PARALLELISM}).`}
            >
              <Input
                type="number"
                value={maxParallelism}
                min={MIN_PARALLELISM}
                max={MAX_PARALLELISM}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v)) setMaxParallelism(v);
                }}
                disabled={!enableParallelAgents}
              />
            </Field>
          </div>
        );
      case 'permissions':
        return <PermissionsPanel />;
      case 'initialization':
        return (
          <div className="flex flex-col gap-4">
            <SectionHeading>initialization</SectionHeading>
            <p className="text-xs leading-relaxed text-muted-foreground">
              wipe the local sqlite database — drops every workspace, session, agent, message,
              transcript, telemetry record, budget rule, permission rule, and skill registration.
              api keys in the os keychain are NOT touched. fresh schema is recreated on next boot.
            </p>
            {wipeError ? (
              <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                {wipeError}
              </p>
            ) : null}
            {wipeState === 'done' ? (
              <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
                database wiped. restart the app (or just reopen settings) to start fresh.
              </p>
            ) : null}
            {wipeState === 'confirm' ? (
              <div className="flex flex-col gap-2 rounded-md border border-danger/40 bg-danger/5 p-3">
                <p className="text-sm font-semibold text-danger">
                  this is irreversible. confirm wipe?
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setWipeState('idle')}>
                    cancel
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => void onWipe()}>
                    wipe database
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
                  {wipeState === 'wiping' ? 'wiping…' : 'wipe local database'}
                </Button>
              </div>
            )}
          </div>
        );
      case 'advanced':
        return (
          <div className="flex flex-col gap-4">
            <SectionHeading>config backup</SectionHeading>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void onExport()}
                disabled={exportState === 'busy'}
              >
                {exportState === 'busy'
                  ? 'exporting…'
                  : exportState === 'done'
                    ? 'exported ✓'
                    : 'export config'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void onImport()}>
                import config
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              export saves workspaces, skills, phase templates, permission rules, budget rules, and
              settings to a json file. api keys are never included.
            </p>
          </div>
        );
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="settings"
      description="configure providers, editor, and workspace defaults."
      size="xl"
      fixedHeightClass="h-[640px]"
      fullScreenOnSmall
      footer={
        <>
          {saveState === 'saved' ? (
            <span className="mr-auto text-xs text-success">saved.</span>
          ) : null}
          {error ? <span className="mr-auto text-xs text-danger">{error}</span> : null}
          <Button variant="ghost" onClick={onClose}>
            close
          </Button>
          {needsSave ? (
            <Button onClick={() => void onSave()} disabled={saveState === 'saving'}>
              {saveState === 'saving' ? 'saving…' : 'save'}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="flex h-full min-h-0 gap-0">
        <nav className="flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto pr-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                activeSection === item.id
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.beta ? <BetaChip /> : null}
            </button>
          ))}
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
    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
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
