import { useEffect, useState } from 'react';
import { Button, Dialog, Input } from '@kay-am/ui';
import { ProvidersPanel } from './ProvidersPanel';
import {
  DEFAULT_BRANCH_PREFIX,
  DEFAULT_EDITOR_BINARY,
  SETTING_EDITOR_BINARY,
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

  const [editorBinary, setEditorBinary] = useState(DEFAULT_EDITOR_BINARY);
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSaveState('idle');
    setError(null);
    void loadSetting(SETTING_EDITOR_BINARY).then((v) =>
      setEditorBinary(v ?? DEFAULT_EDITOR_BINARY),
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
    <Dialog open={open} onClose={onClose} title="settings" className="min-w-96">
      <div className="flex flex-col gap-4">
        <ProvidersPanel />

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

        {error ? <p className="text-xs text-danger">{error}</p> : null}
        {saveState === 'saved' ? <p className="text-xs text-primary">saved.</p> : null}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          close
        </Button>
        <Button onClick={() => void onSave()} disabled={saveState === 'saving'}>
          {saveState === 'saving' ? 'saving…' : 'save'}
        </Button>
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
    <div className="flex flex-col gap-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {children}
      {help ? <p className="text-[11px] text-muted-foreground">{help}</p> : null}
    </div>
  );
}
