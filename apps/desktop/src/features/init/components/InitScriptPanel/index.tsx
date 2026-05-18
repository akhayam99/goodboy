import { useEffect, useState } from 'react';
import { Button, Textarea } from '@kay-am/ui';
import type { WorkspaceId } from '@kay-am/types';
import type { WorkspaceInitScript } from '@kay-am/db';
import { History, Save } from 'lucide-react';
import { formatError } from '../../../../shared/lib/errors';
import { useAppStore } from '../../../../store';
import { InitScriptHistoryDialog } from '../InitScriptHistoryDialog';

interface InitScriptPanelProps {
  readonly workspaceId: WorkspaceId;
}

export function InitScriptPanel({ workspaceId }: InitScriptPanelProps) {
  const loadInitScript = useAppStore((s) => s.loadInitScript);
  const saveInitScript = useAppStore((s) => s.saveInitScript);
  const loadInitScriptHistory = useAppStore((s) => s.loadInitScriptHistory);
  const cached = useAppStore((s) => s.workspaceInitScripts[workspaceId]);

  const [content, setContent] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<ReadonlyArray<WorkspaceInitScript>>([]);

  useEffect(() => {
    void loadInitScript(workspaceId);
  }, [workspaceId, loadInitScript]);

  useEffect(() => {
    if (cached !== undefined && cached !== null) setContent(cached);
  }, [cached]);

  const dirty = content !== (cached ?? '');

  const onSave = async () => {
    setSaveState('saving');
    setError(null);
    try {
      await saveInitScript(workspaceId, content);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1500);
    } catch (err) {
      setError(formatError(err));
      setSaveState('error');
    }
  };

  const onOpenHistory = async () => {
    const entries = await loadInitScriptHistory(workspaceId);
    setHistoryEntries(entries);
    setHistoryOpen(true);
  };

  const onRestore = (entry: WorkspaceInitScript) => {
    setContent(entry.content);
    setHistoryOpen(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">Init Script</h3>
          <p className="text-xs text-muted-foreground">
            runs automatically when a new session starts
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onOpenHistory}>
          <History size={14} />
          History
        </Button>
      </div>

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="# workspace setup&#10;pnpm install&#10;cp .env.example .env"
        className="min-h-[200px] resize-y font-mono text-xs"
        rows={10}
      />

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button size="sm" onClick={onSave} disabled={!dirty || saveState === 'saving'}>
          <Save size={14} />
          {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save'}
        </Button>
      </div>

      <InitScriptHistoryDialog
        open={historyOpen}
        entries={historyEntries}
        onRestore={onRestore}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
