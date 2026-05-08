import { useEffect, useRef, useState, useCallback } from 'react';
import { Button, Tooltip } from '@kay-am/ui';
import type { PermissionAuditEntry, ProviderRunId, SessionId } from '@kay-am/types';
import { useAppStore } from '../../store';
import { invokePermissionAuditList, invokePermissionAuditClear } from '../../permissions';
import { useToast } from '../Toast';

interface Props {
  sessionId: SessionId;
  open: boolean;
  onClose: () => void;
}

const RUNNING_KINDS = new Set(['starting', 'running']);

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function inputPreview(input: unknown): string {
  const raw = typeof input === 'string' ? input : JSON.stringify(input);
  return raw.length > 80 ? raw.slice(0, 80) + '…' : raw;
}

function groupByRunId(
  entries: ReadonlyArray<PermissionAuditEntry>,
): Map<ProviderRunId, ReadonlyArray<PermissionAuditEntry>> {
  const map = new Map<ProviderRunId, PermissionAuditEntry[]>();
  for (const e of entries) {
    const runId = e.request.runId;
    const bucket = map.get(runId) ?? [];
    bucket.push(e);
    map.set(runId, bucket);
  }
  return map as Map<ProviderRunId, ReadonlyArray<PermissionAuditEntry>>;
}

export function PermissionAuditPanel({ sessionId, open, onClose }: Props) {
  const session = useAppStore((s) => s.sessions.find((x) => x.id === sessionId));
  const isStreaming = RUNNING_KINDS.has(session?.state.kind ?? 'idle');
  const { showToast } = useToast();

  const [entries, setEntries] = useState<ReadonlyArray<PermissionAuditEntry>>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const [filterTool, setFilterTool] = useState('');
  const [filterDecision, setFilterDecision] = useState<'all' | 'allow' | 'deny'>('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    if (!open) return;
    try {
      const result = await invokePermissionAuditList({ sessionId, limit: 500 });
      setEntries(result);
    } catch {
      // silent — panel will show stale data
    }
  }, [open, sessionId]);

  useEffect(() => {
    if (!open) {
      setEntries([]);
      setFilterTool('');
      setFilterDecision('all');
      setFilterFrom('');
      setFilterTo('');
      setConfirmClear(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    setLoading(true);
    void fetch().finally(() => setLoading(false));

    if (isStreaming) {
      intervalRef.current = setInterval(() => void fetch(), 2000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [open, fetch, isStreaming]);

  useEffect(() => {
    if (!open) return;
    if (isStreaming && !intervalRef.current) {
      intervalRef.current = setInterval(() => void fetch(), 2000);
    } else if (!isStreaming && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [isStreaming, open, fetch]);

  const onClear = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setClearing(true);
    try {
      await invokePermissionAuditClear({ sessionId });
      setEntries([]);
      showToast('warning', 'audit log cleared for this session');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'clear failed');
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  };

  const filtered = entries.filter((e) => {
    if (filterTool && !e.request.toolName.toLowerCase().includes(filterTool.toLowerCase()))
      return false;
    if (filterDecision !== 'all') {
      const outcome = e.decision.decision;
      if (filterDecision === 'allow' && outcome !== 'allow') return false;
      if (filterDecision === 'deny' && outcome !== 'deny') return false;
    }
    if (filterFrom) {
      const from = new Date(filterFrom).getTime();
      if (new Date(e.request.at).getTime() < from) return false;
    }
    if (filterTo) {
      const to = new Date(filterTo).getTime() + 86400000;
      if (new Date(e.request.at).getTime() > to) return false;
    }
    return true;
  });

  const grouped = groupByRunId(filtered);
  const runIds = [...grouped.keys()];

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" aria-hidden onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-[480px] max-w-full flex-col border-l border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">permission audit log</span>
          <Tooltip content="close" side="left">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="close audit panel"
            >
              ✕
            </button>
          </Tooltip>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <input
            type="text"
            placeholder="filter by tool…"
            value={filterTool}
            onChange={(e) => setFilterTool(e.target.value)}
            className="h-7 w-36 rounded border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground"
          />
          <select
            value={filterDecision}
            onChange={(e) => setFilterDecision(e.target.value as 'all' | 'allow' | 'deny')}
            className="h-7 rounded border border-border bg-background px-1 text-xs text-foreground"
          >
            <option value="all">all decisions</option>
            <option value="allow">allow only</option>
            <option value="deny">deny only</option>
          </select>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="h-7 rounded border border-border bg-background px-1 text-xs text-foreground"
            title="from date"
          />
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="h-7 rounded border border-border bg-background px-1 text-xs text-foreground"
            title="to date"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="text-xs text-muted-foreground">loading…</p>
          ) : runIds.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              no tool calls recorded for this session yet.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {runIds.map((runId) => {
                const runEntries = grouped.get(runId)!;
                const firstAt = runEntries[0]?.request.at ?? '';
                return (
                  <div key={runId} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                        run
                      </span>
                      <span className="font-mono text-2xs text-muted-foreground">
                        {String(runId).slice(0, 12)}…
                      </span>
                      {firstAt ? (
                        <span className="text-2xs text-muted-foreground/60">
                          {formatTime(firstAt)}
                        </span>
                      ) : null}
                    </div>
                    <ul className="flex flex-col divide-y divide-border-soft overflow-hidden rounded-md border border-border-soft bg-subtle">
                      {runEntries.map((e) => (
                        <AuditRow key={e.request.id} entry={e} />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end border-t border-border px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={() => void onClear()} disabled={clearing}>
            {confirmClear ? 'confirm clear?' : clearing ? 'clearing…' : 'clear audit for session'}
          </Button>
        </div>
      </div>
    </>
  );
}

function AuditRow({ entry }: { entry: PermissionAuditEntry }) {
  const isAllow = entry.decision.decision === 'allow';
  const ruleLabel =
    entry.decision.decidedBy === 'default'
      ? 'default'
      : entry.decision.ruleId
        ? `rule:${String(entry.decision.ruleId).slice(0, 8)}`
        : entry.decision.decidedBy;

  return (
    <li className="flex items-start gap-3 px-3 py-2 text-xs">
      <span className="shrink-0 font-mono text-2xs text-muted-foreground/70">
        {formatTime(entry.request.at)}
      </span>
      <span className="min-w-0 flex-1 font-mono text-xs">
        <span className="font-semibold">{entry.request.toolName}</span>
        <span className="ml-1 text-muted-foreground">{inputPreview(entry.request.input)}</span>
      </span>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span
          className={
            isAllow
              ? 'rounded-full bg-green-100 px-1.5 py-0.5 text-2xs font-medium text-green-700'
              : 'rounded-full bg-red-100 px-1.5 py-0.5 text-2xs font-medium text-red-700'
          }
        >
          {isAllow ? 'allow' : 'deny'}
        </span>
        <span className="text-2xs text-muted-foreground/60">{ruleLabel}</span>
      </div>
    </li>
  );
}
