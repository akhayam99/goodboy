import { useEffect, useState } from 'react';
import { Button, Dialog, Input } from '@kay-am/ui';
import { ProvidersPanel } from './ProvidersPanel';
import { BudgetRulesPanel } from './BudgetRulesPanel';
import { PermissionsPanel } from './PermissionsPanel';
import { ProviderPricingPanel } from './ProviderPricingPanel';
import { SkillsPanel } from './SkillsPanel';
import { PhasesPanel } from './PhasesPanel';
import {
  DEFAULT_BRANCH_PREFIX,
  DEFAULT_EDITOR_BINARY,
  SETTING_EDITOR_BINARY,
  SETTING_PROVIDER_PRICING_CONFIG,
  settingBranchPrefix,
} from '../settings';
import { parseProviderPricingConfig, type ProviderPricingConfig } from '../providerPricing';
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

  const [editorBinary, setEditorBinary] = useState(DEFAULT_EDITOR_BINARY);
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [pricingConfig, setPricingConfig] = useState<ProviderPricingConfig>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSaveState('idle');
    setError(null);
    void loadSetting(SETTING_EDITOR_BINARY).then((v) =>
      setEditorBinary(v ?? DEFAULT_EDITOR_BINARY),
    );
    void loadSetting(SETTING_PROVIDER_PRICING_CONFIG).then((v) =>
      setPricingConfig(parseProviderPricingConfig(v)),
    );
    if (workspace) {
      void loadSetting(settingBranchPrefix(workspace.id)).then((v) =>
        setBranchPrefix(v ?? DEFAULT_BRANCH_PREFIX),
      );
    }
  }, [open, workspace, loadSetting]);

  const onSave = async () => {
    setSaveState('saving');
    setError(null);
    try {
      await saveSetting(SETTING_EDITOR_BINARY, editorBinary.trim() || DEFAULT_EDITOR_BINARY);
      await saveSetting(SETTING_PROVIDER_PRICING_CONFIG, JSON.stringify(pricingConfig));
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

      <div className="border-t border-border-soft pt-4">
        <ProviderPricingPanel config={pricingConfig} onChange={setPricingConfig} />
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
