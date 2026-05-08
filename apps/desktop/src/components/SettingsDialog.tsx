import { useEffect, useState } from 'react';
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

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const workspace = useCurrentWorkspace();
  const loadSetting = useAppStore((s) => s.loadSetting);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const exportConfig = useAppStore((s) => s.exportConfig);
  const importConfig = useAppStore((s) => s.importConfig);

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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="settings"
      description="providers, editor and per-workspace defaults."
      size="lg"
      footer={
        <>
          {saveState === 'saved' ? (
            <span className="mr-auto text-xs text-success">saved.</span>
          ) : null}
          {error ? <span className="mr-auto text-xs text-danger">{error}</span> : null}
          <Button variant="ghost" onClick={onClose}>
            close
          </Button>
          <Button onClick={() => void onSave()} disabled={saveState === 'saving'}>
            {saveState === 'saving' ? 'saving…' : 'save'}
          </Button>
        </>
      }
    >
      <ProvidersPanel />

      <div className="border-t border-border-soft pt-4">
        <BudgetRulesPanel />
      </div>

      {workspace ? (
        <div className="border-t border-border-soft pt-4">
          <SkillsPanel workspaceId={workspace.id} />
        </div>
      ) : null}

      {workspace ? (
        <div className="border-t border-border-soft pt-4">
          <PhasesPanel workspaceId={workspace.id} />
        </div>
      ) : null}

      <div className="border-t border-border-soft pt-4">
        <PermissionsPanel />
      </div>

      <div className="flex flex-col gap-4 border-t border-border-soft pt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          experimental — multi-agent parallel
        </div>
        <Section
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
            <span className="text-sm text-foreground">{enableParallelAgents ? 'on' : 'off'}</span>
          </label>
        </Section>
        <Section
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
        </Section>
      </div>

      <div className="flex flex-col gap-4 border-t border-border-soft pt-4">
        <Section label="default editor binary" help={`launched as: \`${editorBinary} <path>\``}>
          <Input
            value={editorBinary}
            onChange={(e) => setEditorBinary(e.target.value)}
            placeholder={DEFAULT_EDITOR_BINARY}
          />
        </Section>

        <Section
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
        </Section>
      </div>

      <div className="flex flex-col gap-3 border-t border-border-soft pt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          advanced — config backup
        </div>
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
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          export saves workspaces, skills, phase templates, permission rules, budget rules, and
          settings to a json file. api keys are never included.
        </p>
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

function Section({
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
      {help ? <p className="text-[11px] leading-relaxed text-muted-foreground">{help}</p> : null}
    </div>
  );
}
