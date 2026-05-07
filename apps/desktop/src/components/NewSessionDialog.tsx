import { useEffect, useState } from 'react';
import { Button, Dialog, Input, Textarea } from '@kay-am/ui';
import type { WorkspaceId } from '@kay-am/types';
import { DEFAULT_BRANCH_PREFIX, settingBranchPrefix } from '../settings';
import { useAppStore } from '../store';

interface NewSessionDialogProps {
  open: boolean;
  onClose: () => void;
  workspaceId: WorkspaceId;
}

export function NewSessionDialog({ open, onClose, workspaceId }: NewSessionDialogProps) {
  const createSession = useAppStore((s) => s.createSession);
  const loadSetting = useAppStore((s) => s.loadSetting);
  const settingKey = settingBranchPrefix(workspaceId);
  const storedPrefix = useAppStore((s) => s.settings[settingKey]);
  const [goal, setGoal] = useState('');
  const [prefix, setPrefix] = useState(storedPrefix ?? DEFAULT_BRANCH_PREFIX);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void loadSetting(settingKey).then((value) => {
      setPrefix(value ?? DEFAULT_BRANCH_PREFIX);
    });
  }, [open, settingKey, loadSetting]);

  const reset = () => {
    setGoal('');
    setPrefix(storedPrefix ?? DEFAULT_BRANCH_PREFIX);
    setError(null);
  };

  const onCreate = async () => {
    setError(null);
    setBusy(true);
    try {
      await createSession({ workspaceId, goal, branchPrefix: prefix });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="new session">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          goal
          <Textarea
            value={goal}
            placeholder="refactor auth domain"
            onChange={(e) => setGoal(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          branch prefix
          <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="kay" />
        </label>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          cancel
        </Button>
        <Button onClick={onCreate} disabled={goal.trim().length === 0 || busy}>
          {busy ? 'creating…' : 'create'}
        </Button>
      </div>
    </Dialog>
  );
}
