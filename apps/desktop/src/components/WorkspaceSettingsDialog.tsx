import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@kay-am/types';
import { Button, Dialog, Input } from '@kay-am/ui';
import { FolderCode, GitBranch, Zap } from 'lucide-react';
import { SkillsPanel } from './SkillsPanel';
import { PhasesPanel } from './PhasesPanel';
import { DEFAULT_BRANCH_PREFIX, settingBranchPrefix } from '../settings';
import { useAppStore } from '../store';

interface WorkspaceSettingsDialogProps {
  workspaceId: WorkspaceId;
  workspaceName: string;
  open: boolean;
  onClose: () => void;
}

type Section = 'general' | 'skills' | 'phases';

interface NavItem {
  id: Section;
  label: string;
  icon: React.ReactNode;
  beta?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'general', label: 'general', icon: <FolderCode size={14} aria-hidden /> },
  { id: 'skills', label: 'skills', icon: <Zap size={14} aria-hidden /> },
  { id: 'phases', label: 'phases', icon: <GitBranch size={14} aria-hidden />, beta: true },
];

function BetaChip() {
  return (
    <span className="ml-auto rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600">
      beta
    </span>
  );
}

export function WorkspaceSettingsDialog({
  workspaceId,
  workspaceName,
  open,
  onClose,
}: WorkspaceSettingsDialogProps) {
  const loadSetting = useAppStore((s) => s.loadSetting);
  const saveSetting = useAppStore((s) => s.saveSetting);

  const [active, setActive] = useState<Section>('general');
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSaveState('idle');
    setError(null);
    void loadSetting(settingBranchPrefix(workspaceId)).then((v) =>
      setBranchPrefix(v ?? DEFAULT_BRANCH_PREFIX),
    );
  }, [open, workspaceId, loadSetting]);

  const onSave = async () => {
    setSaveState('saving');
    setError(null);
    try {
      await saveSetting(
        settingBranchPrefix(workspaceId),
        branchPrefix.trim() || DEFAULT_BRANCH_PREFIX,
      );
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const needsSave = active === 'general';

  const renderContent = () => {
    switch (active) {
      case 'general':
        return (
          <div className="flex flex-col gap-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              workspace defaults
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="text-xs font-semibold text-foreground">branch prefix</div>
              <Input
                value={branchPrefix}
                onChange={(e) => setBranchPrefix(e.target.value)}
                placeholder={DEFAULT_BRANCH_PREFIX}
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                used as the default in the new-session dialog for this workspace.
              </p>
            </div>
          </div>
        );
      case 'skills':
        return <SkillsPanel workspaceId={workspaceId} />;
      case 'phases':
        return <PhasesPanel workspaceId={workspaceId} />;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${workspaceName} — settings`}
      description="per-workspace defaults, skills, and workflow templates."
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
              onClick={() => setActive(item.id)}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                active === item.id
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
    </Dialog>
  );
}
