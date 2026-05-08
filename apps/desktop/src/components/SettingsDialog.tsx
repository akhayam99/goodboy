import { useEffect, useState } from 'react';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Cpu,
  DollarSign,
  FileDown,
  FolderCode,
  GitBranch,
  Lock,
  Zap,
} from 'lucide-react';
import { Button, Dialog, Input } from '@kay-am/ui';
import { ProvidersPanel } from './ProvidersPanel';
import { BudgetRulesPanel } from './BudgetRulesPanel';
import { PermissionsPanel } from './PermissionsPanel';
import { SkillsPanel } from './SkillsPanel';
import { PhasesPanel } from './PhasesPanel';
import { ImportConfigDialog } from './ImportConfigDialog';
import type { ConfigBundleImportResult } from '@kay-am/types';
import {
  DEFAULT_BRANCH_PREFIX,
  DEFAULT_EDITOR_BINARY,
  DEFAULT_ENABLE_PARALLEL_AGENTS,
  DEFAULT_MAX_PARALLELISM,
  MAX_PARALLELISM,
  MIN_PARALLELISM,
  SETTING_EDITOR_BINARY,
  SETTING_ENABLE_PARALLEL_AGENTS,
  SETTING_MAX_PARALLELISM,
  settingBranchPrefix,
} from '../settings';
import { useAppStore, useCurrentWorkspace } from '../store';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type NavSection =
  | 'app'
  | 'providers'
  | 'budget'
  | 'agent'
  | 'skills'
  | 'phases'
  | 'permissions'
  | 'advanced';

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'app', label: 'app', icon: <FolderCode size={14} aria-hidden /> },
  { id: 'providers', label: 'providers', icon: <Cpu size={14} aria-hidden /> },
  { id: 'budget', label: 'budget', icon: <DollarSign size={14} aria-hidden /> },
  { id: 'agent', label: 'agent', icon: <Bot size={14} aria-hidden /> },
  { id: 'skills', label: 'skills', icon: <Zap size={14} aria-hidden /> },
  { id: 'phases', label: 'phases', icon: <GitBranch size={14} aria-hidden /> },
  { id: 'permissions', label: 'permissions', icon: <Lock size={14} aria-hidden /> },
  { id: 'advanced', label: 'advanced', icon: <FileDown size={14} aria-hidden /> },
];

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const workspace = useCurrentWorkspace();
  const loadSetting = useAppStore((s) => s.loadSetting);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const exportConfig = useAppStore((s) => s.exportConfig);
  const importConfig = useAppStore((s) => s.importConfig);
  const providers = useAppStore((s) => s.providers);

  const [activeSection, setActiveSection] = useState<NavSection>('providers');
  const [editorBinary, setEditorBinary] = useState(DEFAULT_EDITOR_BINARY);
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [enableParallelAgents, setEnableParallelAgents] = useState(DEFAULT_ENABLE_PARALLEL_AGENTS);
  const [maxParallelism, setMaxParallelism] = useState(DEFAULT_MAX_PARALLELISM);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [exportState, setExportState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<ConfigBundleImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [providerOrder, setProviderOrder] = useState(() => [...providers]);

  useEffect(() => {
    setProviderOrder([...providers]);
  }, [providers]);

  useEffect(() => {
    if (!open) return;
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
    if (workspace) {
      void loadSetting(settingBranchPrefix(workspace.id)).then((v) =>
        setBranchPrefix(v ?? DEFAULT_BRANCH_PREFIX),
      );
    }
  }, [open, workspace, loadSetting]);

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
      if (workspace) {
        await saveSetting(
          settingBranchPrefix(workspace.id),
          branchPrefix.trim() || DEFAULT_BRANCH_PREFIX,
        );
      }
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const moveProvider = (index: number, direction: -1 | 1) => {
    const next = [...providerOrder];
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    const a = next[index];
    const b = next[swapIndex];
    if (a === undefined || b === undefined) return;
    next[index] = b;
    next[swapIndex] = a;
    setProviderOrder(next);
    // TODO (@ak): persist provider order via store action
  };

  const needsSave =
    activeSection === 'app' || activeSection === 'agent' || activeSection === 'advanced';

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
            <Field
              label={
                workspace ? `branch prefix — ${workspace.name}` : 'branch prefix (workspace scoped)'
              }
              help={
                workspace
                  ? 'used as default in the new-session dialog'
                  : 'select a workspace to edit per-workspace prefix'
              }
            >
              <Input
                value={branchPrefix}
                onChange={(e) => setBranchPrefix(e.target.value)}
                placeholder={DEFAULT_BRANCH_PREFIX}
                disabled={!workspace}
              />
            </Field>
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
            <div className="flex flex-col gap-2">
              <div className="text-xs font-semibold text-foreground">provider priority order</div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                providers are tried top-to-bottom when routing a turn.
              </p>
              <ul className="flex flex-col gap-1">
                {providerOrder.map((p, i) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 rounded-md border border-border-soft bg-muted/40 px-3 py-2"
                  >
                    <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
                    <span className="flex-1 text-sm font-medium">{p.label}</span>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => moveProvider(i, -1)}
                        disabled={i === 0}
                        className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                        aria-label={`move ${p.label} up`}
                      >
                        <ChevronUp size={13} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveProvider(i, 1)}
                        disabled={i === providerOrder.length - 1}
                        className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                        aria-label={`move ${p.label} down`}
                      >
                        <ChevronDown size={13} aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      case 'skills':
        return workspace ? (
          <SkillsPanel workspaceId={workspace.id} />
        ) : (
          <EmptyWorkspace section="skills" />
        );
      case 'phases':
        return workspace ? (
          <PhasesPanel workspaceId={workspace.id} />
        ) : (
          <EmptyWorkspace section="phases" />
        );
      case 'permissions':
        return <PermissionsPanel />;
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
      <div className="flex min-h-[480px] gap-0">
        <nav className="flex w-40 shrink-0 flex-col gap-0.5 border-r border-border-soft pr-2">
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
              {item.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 pl-4">{renderContent()}</div>
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

function EmptyWorkspace({ section }: { section: string }) {
  return (
    <p className="text-sm text-muted-foreground">select a workspace to manage its {section}.</p>
  );
}
