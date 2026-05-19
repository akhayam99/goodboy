import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@kay-am/types';
import { Button, Dialog, Input, cn } from '@kay-am/ui';
import { FolderCode, GitBranch, Terminal, Unplug, Zap } from 'lucide-react';
import { SkillsPanel } from '../../../../features/skills/components/SkillsPanel';
import { PhasesPanel } from '../../../../features/phases/components/PhasesPanel';
import { InitScriptPanel } from '../../../../features/init';
import { BulkSessionDeleteDialog } from '../WorkspacesSidebar';
import { formatError } from '../../../../shared/lib/errors';
import { DEFAULT_BRANCH_PREFIX, settingBranchPrefix } from '../../../../features/settings/settings';
import { WORKSPACE_FEATURES } from '../../../../shared/lib/features';
import { useAppStore, useSessions } from '../../../../store';

type Section = 'general' | 'skills' | 'init' | 'phases' | 'danger';

interface WorkspaceSettingsDialogProps {
  workspaceId: WorkspaceId;
  workspaceName: string;
  open: boolean;
  onClose: () => void;
  initialSection?: Section;
}

interface NavItem {
  id: Section;
  label: string;
  icon: React.ReactNode;
  beta?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'general', label: 'General', icon: <FolderCode size={14} aria-hidden /> },
  ...(WORKSPACE_FEATURES.skills
    ? [{ id: 'skills' as const, label: 'Skills', icon: <Zap size={14} aria-hidden /> }]
    : []),
  ...(WORKSPACE_FEATURES.initScript
    ? [{ id: 'init' as const, label: 'Init', icon: <Terminal size={14} aria-hidden /> }]
    : []),
  { id: 'phases', label: 'Workflows', icon: <GitBranch size={14} aria-hidden />, beta: true },
];

const DANGER_NAV: NavItem = {
  id: 'danger',
  label: 'Disconnect',
  icon: <Unplug size={14} aria-hidden />,
};

function BetaChip() {
  return (
    <span className="ml-auto rounded-sm bg-warning/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-warning">
      beta
    </span>
  );
}

export function WorkspaceSettingsDialog({
  workspaceId,
  workspaceName,
  open,
  onClose,
  initialSection = 'general',
}: WorkspaceSettingsDialogProps) {
  const loadSetting = useAppStore((s) => s.loadSetting);
  const saveSetting = useAppStore((s) => s.saveSetting);

  const deleteWorkspace = useAppStore((s) => s.deleteWorkspace);
  const sessions = useSessions();
  const workspaceSessions = sessions.filter((s) => s.workspaceId === workspaceId);

  const [active, setActive] = useState<Section>(initialSection);

  useEffect(() => {
    if (open) setActive(initialSection);
  }, [open, initialSection]);
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirmDisconnect(false);
    setDisconnecting(false);
    setBulkDeleteOpen(false);
  }, [open]);

  const onDisconnect = async () => {
    if (workspaceSessions.length > 0) {
      setBulkDeleteOpen(true);
      return;
    }
    setDisconnecting(true);
    setError(null);
    try {
      await deleteWorkspace(workspaceId);
      onClose();
    } catch (err) {
      setError(formatError(err));
      setDisconnecting(false);
    }
  };

  const onBulkDeleted = async () => {
    setBulkDeleteOpen(false);
    setDisconnecting(true);
    setError(null);
    try {
      await deleteWorkspace(workspaceId);
      onClose();
    } catch (err) {
      setError(formatError(err));
      setDisconnecting(false);
    }
  };

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
      setError(formatError(err));
    }
  };

  const needsSave = active === 'general';

  const renderContent = () => {
    switch (active) {
      case 'general':
        return (
          <div className="flex flex-col gap-4">
            <div className="text-xs font-semibold tracking-wide text-muted-foreground">
              Workspace defaults
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
      case 'init':
        return <InitScriptPanel workspaceId={workspaceId} />;
      case 'phases':
        return <PhasesPanel workspaceId={workspaceId} />;
      case 'danger':
        return (
          <div className="flex flex-col gap-5">
            <div>
              <div className="text-xs font-semibold tracking-wide text-danger">Danger zone</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                irreversible workspace actions.
              </p>
            </div>

            <div
              className={cn(
                'flex flex-col gap-3 rounded-md border p-3 transition-colors',
                confirmDisconnect ? 'border-danger/40 bg-danger/5' : 'border-border-soft',
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-xs font-semibold text-foreground">disconnect workspace</div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    removes kAY.am state (sessions, transcripts, worktrees, audit). the repository
                    on disk is left untouched. you can re-add it later.
                  </p>
                </div>
                {!confirmDisconnect ? (
                  <Button
                    variant="danger"
                    onClick={() => setConfirmDisconnect(true)}
                    disabled={disconnecting}
                  >
                    <Unplug size={13} aria-hidden className="mr-1.5" />
                    Disconnect
                  </Button>
                ) : null}
              </div>

              {confirmDisconnect ? (
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmDisconnect(false)}
                    disabled={disconnecting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => void onDisconnect()}
                    disabled={disconnecting}
                  >
                    {disconnecting ? 'Disconnecting…' : 'Confirm disconnect'}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={workspaceName}
        description="Per-workspace defaults, skills, and workflow templates."
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
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item.id)}
                className={`relative flex items-center gap-2 rounded-md py-1.5 pl-3 pr-2 text-left text-sm transition-colors ${
                  active === item.id
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
              <button
                type="button"
                onClick={() => setActive('danger')}
                className={`relative flex w-full items-center gap-2 rounded-md py-1.5 pl-3 pr-2 text-left text-sm transition-colors ${
                  active === 'danger'
                    ? 'bg-danger/15 font-medium text-danger before:absolute before:left-1 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-danger'
                    : 'text-danger/80 hover:bg-danger/10 hover:text-danger'
                }`}
              >
                {DANGER_NAV.icon}
                <span>{DANGER_NAV.label}</span>
              </button>
            </div>
          </nav>
          <div className="min-w-0 flex-1 overflow-y-auto pl-4">{renderContent()}</div>
        </div>
      </Dialog>
      <BulkSessionDeleteDialog
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onDeleted={() => void onBulkDeleted()}
      />
    </>
  );
}
