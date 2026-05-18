import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button, Textarea, cn } from '@kay-am/ui';
import type { ProviderId, WorkspaceId } from '@kay-am/types';
import type { WorkspaceInitScript } from '@kay-am/db';
import { ChevronDown, ChevronUp, Loader2, RotateCcw, Save, Wand2 } from 'lucide-react';
import { formatError } from '../../../../shared/lib/errors';
import { useAppStore } from '../../../../store';

interface InitScriptPanelProps {
  readonly workspaceId: WorkspaceId;
}

interface QuickLlmResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
}

function getCheapModel(providerId: ProviderId): string {
  switch (providerId) {
    case 'anthropic':
      return 'claude-haiku-4-5';
    case 'cursor':
      return 'composer-2-fast';
    case 'codex':
      return 'gpt-5.4-mini';
    default:
      return 'claude-haiku-4-5';
  }
}

function getDefaultBinary(providerId: ProviderId): string {
  switch (providerId) {
    case 'anthropic':
      return 'claude';
    case 'cursor':
      return 'cursor-agent';
    case 'codex':
      return 'codex';
    default:
      return 'claude';
  }
}

const REGENERATE_SYSTEM =
  'You are a workspace setup script optimizer. Rewrite the given init script to be minimal and efficient. Keep only essential shell commands and brief inline comments. Remove verbose prose, redundant steps, and unnecessary whitespace. Output ONLY the cleaned script, nothing else.';

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function InitScriptPanel({ workspaceId }: InitScriptPanelProps) {
  const loadInitScript = useAppStore((s) => s.loadInitScript);
  const saveInitScript = useAppStore((s) => s.saveInitScript);
  const loadInitScriptHistory = useAppStore((s) => s.loadInitScriptHistory);
  const cached = useAppStore((s) => s.workspaceInitScripts[workspaceId]);
  const connectedProviderId = useAppStore((s) => {
    if (s.providerStatus?.available) return s.providerStatus.id as ProviderId;
    if (s.cursorStatus?.available) return 'cursor' as ProviderId;
    if (s.codexStatus?.available) return 'codex' as ProviderId;
    return 'anthropic' as ProviderId;
  });

  const [content, setContent] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [regenBusy, setRegenBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<ReadonlyArray<WorkspaceInitScript>>([]);
  const historyRef = useRef<HTMLDivElement>(null);

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

  const onToggleHistory = useCallback(async () => {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    try {
      const entries = await loadInitScriptHistory(workspaceId);
      setHistoryEntries(entries);
      setHistoryOpen(true);
    } catch (err) {
      setError(formatError(err));
    }
  }, [historyOpen, loadInitScriptHistory, workspaceId]);

  const onRestore = (entry: WorkspaceInitScript) => {
    setContent(entry.content);
    setHistoryOpen(false);
  };

  const onRegenerate = async () => {
    if (!content.trim()) return;
    setRegenBusy(true);
    setError(null);
    const providerId = connectedProviderId;
    try {
      const result = await invoke<QuickLlmResult>('summarize_session', {
        args: {
          providerId,
          model: getCheapModel(providerId),
          binary: getDefaultBinary(providerId),
          userMessage: content,
          systemPrompt: REGENERATE_SYSTEM,
        },
      });
      if ((result.exitCode ?? 0) !== 0) {
        throw new Error(result.stderr || 'regenerate failed');
      }
      let text = result.stdout.trim();
      try {
        const parsed = JSON.parse(text) as { result?: string };
        if (typeof parsed.result === 'string') text = parsed.result.trim();
      } catch {
        // not json, use raw
      }
      if (text) {
        await saveInitScript(workspaceId, content);
        setContent(text);
      }
    } catch (err) {
      setError(formatError(err));
    } finally {
      setRegenBusy(false);
    }
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
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            disabled={regenBusy || !content.trim()}
            title="rewrite script to be minimal and efficient"
          >
            {regenBusy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            Cleanup
          </Button>
          <Button variant="ghost" size="sm" onClick={onToggleHistory}>
            {historyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            History
          </Button>
        </div>
      </div>

      {historyOpen && (
        <div
          ref={historyRef}
          className="max-h-[200px] overflow-y-auto rounded-md border border-border-soft bg-subtle p-2"
        >
          {historyEntries.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground italic">no history yet</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {historyEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="group flex flex-col gap-1 rounded-sm border border-border-soft bg-background p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xs text-muted-foreground">
                      {formatRelative(entry.createdAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRestore(entry)}
                      className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-2xs text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                    >
                      <RotateCcw size={10} aria-hidden />
                      restore
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-2xs leading-relaxed text-foreground/80 line-clamp-3">
                    {entry.content}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="# workspace setup&#10;pnpm install&#10;cp .env.example .env"
        className="min-h-[200px] resize-y font-mono text-xs"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        rows={10}
      />

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button size="sm" onClick={onSave} disabled={!dirty || saveState === 'saving'}>
          <Save size={14} />
          {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
