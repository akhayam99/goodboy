import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Dialog, Divider } from '@goodboy/ui';
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  Loader2,
  ScrollText,
  ShieldOff,
  Trash2,
  XCircle,
} from 'lucide-react';
import type {
  PermissionAuditEntry,
  PermissionRule,
  PermissionRuleId,
  PermissionRuleScope,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';

interface PermissionRulesDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
}

const DELETE_ARM_TIMEOUT_MS = 4000;

const SCOPE_META: Record<
  PermissionRuleScope,
  { label: string; description: string; icon: typeof Globe }
> = {
  global: {
    label: 'Global',
    description: 'applies across every workspace and session',
    icon: Globe,
  },
  workspace: {
    label: 'Workspace',
    description: 'applies to every session in this workspace',
    icon: ShieldOff,
  },
  session: {
    label: 'Session',
    description: 'applies only to the current session',
    icon: CheckCircle2,
  },
};

export function PermissionRulesDialog({
  open,
  onClose,
  sessionId,
  workspaceId,
}: PermissionRulesDialogProps) {
  const loadPermissionRules = useAppStore((s) => s.loadPermissionRules);
  const revokePermissionRule = useAppStore((s) => s.revokePermissionRule);
  const loadPermissionAuditLog = useAppStore((s) => s.loadPermissionAuditLog);

  const [rules, setRules] = useState<ReadonlyArray<PermissionRule>>([]);
  const [audit, setAudit] = useState<ReadonlyArray<PermissionAuditEntry>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, a] = await Promise.all([
        loadPermissionRules({ workspaceId, sessionId }),
        loadPermissionAuditLog({ workspaceId, sessionId, limit: 50 }),
      ]);
      setRules(r);
      setAudit(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [loadPermissionRules, loadPermissionAuditLog, sessionId, workspaceId]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  const onRevoke = async (id: PermissionRuleId) => {
    try {
      await revokePermissionRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const grouped = groupRulesByScope(rules);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Permission rules"
      description="every rule lives until you revoke it. once-only approvals never appear here."
      size="lg"
      fixedHeightClass="h-[560px]"
      footer={
        <div className="flex w-full items-center gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => setShowAudit((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 hover:bg-muted hover:text-foreground"
          >
            <ScrollText size={12} aria-hidden />
            {showAudit ? 'hide audit log' : `show audit log (${audit.length})`}
          </button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {error ? (
          <div className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        ) : null}
        {loading && rules.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
            <Loader2 size={13} className="animate-spin" aria-hidden /> loading rules…
          </div>
        ) : (
          (['global', 'workspace', 'session'] as PermissionRuleScope[]).map((scope) => (
            <RuleSection
              key={scope}
              scope={scope}
              rules={grouped[scope] ?? []}
              onRevoke={onRevoke}
            />
          ))
        )}
        {showAudit ? <AuditSection entries={audit} /> : null}
      </div>
    </Dialog>
  );
}

function groupRulesByScope(
  rules: ReadonlyArray<PermissionRule>,
): Record<PermissionRuleScope, ReadonlyArray<PermissionRule>> {
  const out: Record<PermissionRuleScope, PermissionRule[]> = {
    global: [],
    workspace: [],
    session: [],
  };
  for (const r of rules) out[r.scope].push(r);
  return out;
}

interface RuleSectionProps {
  readonly scope: PermissionRuleScope;
  readonly rules: ReadonlyArray<PermissionRule>;
  readonly onRevoke: (id: PermissionRuleId) => void | Promise<void>;
}

function RuleSection({ scope, rules, onRevoke }: RuleSectionProps) {
  const meta = SCOPE_META[scope];
  const Icon = meta.icon;
  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-baseline justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
          <Icon size={12} aria-hidden className="text-muted-foreground" />
          {meta.label}
          <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-2xs font-normal text-muted-foreground">
            {rules.length}
          </span>
        </h3>
        <span className="text-2xs text-muted-foreground/80">{meta.description}</span>
      </header>
      {rules.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
          no rules yet — they appear here after you approve a permission request.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-muted/10">
          {rules.map((rule) => (
            <RuleRow key={rule.id} rule={rule} onRevoke={onRevoke} />
          ))}
        </ul>
      )}
    </section>
  );
}

interface RuleRowProps {
  readonly rule: PermissionRule;
  readonly onRevoke: (id: PermissionRuleId) => void | Promise<void>;
}

function RuleRow({ rule, onRevoke }: RuleRowProps) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const armTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (armTimer.current !== null) {
        window.clearTimeout(armTimer.current);
        armTimer.current = null;
      }
    };
  }, []);

  const handleClick = async () => {
    if (!armed) {
      setArmed(true);
      if (armTimer.current !== null) window.clearTimeout(armTimer.current);
      armTimer.current = window.setTimeout(() => {
        setArmed(false);
        armTimer.current = null;
      }, DELETE_ARM_TIMEOUT_MS);
      return;
    }
    setBusy(true);
    try {
      await onRevoke(rule.id);
    } finally {
      setBusy(false);
      setArmed(false);
      if (armTimer.current !== null) {
        window.clearTimeout(armTimer.current);
        armTimer.current = null;
      }
    }
  };

  return (
    <li className="flex items-center gap-3 px-3 py-2 text-xs">
      <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground">
        {rule.pattern.tool}
        {rule.pattern.argsMatcher ? `(${rule.pattern.argsMatcher})` : ''}
      </code>
      <DecisionPill decision={rule.decision} />
      <span className="text-muted-foreground/70">priority {rule.priority}</span>
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={busy}
        title={armed ? 'click again to confirm — removes the rule immediately' : 'revoke this rule'}
        aria-label={armed ? 'confirm revoke' : 'revoke rule'}
        className={
          armed
            ? 'inline-flex items-center gap-1 rounded-full bg-danger px-2 py-0.5 text-[10px] font-semibold text-danger-foreground animate-pulse'
            : 'rounded p-1 text-muted-foreground/70 transition-colors hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50'
        }
      >
        {busy ? (
          <Loader2 size={11} className="animate-spin" aria-hidden />
        ) : armed ? (
          <>
            <AlertTriangle size={10} aria-hidden /> confirm
          </>
        ) : (
          <Trash2 size={11} aria-hidden />
        )}
      </button>
    </li>
  );
}

function DecisionPill({ decision }: { decision: PermissionRule['decision'] }) {
  if (decision === 'allow') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
        <CheckCircle2 size={9} aria-hidden /> allow
      </span>
    );
  }
  if (decision === 'deny') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-[10px] font-medium text-danger">
        <XCircle size={9} aria-hidden /> deny
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      ask
    </span>
  );
}

function AuditSection({ entries }: { entries: ReadonlyArray<PermissionAuditEntry> }) {
  return (
    <section className="flex flex-col gap-2">
      <Divider />
      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
        Audit log (last {entries.length})
      </h3>
      {entries.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
          no audit entries yet for this scope.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-muted/10">
          {entries.map((e) => (
            <li
              key={e.request.id}
              className="flex items-center gap-2 px-3 py-1.5 text-2xs text-muted-foreground"
            >
              <code className="rounded bg-background px-1 py-0.5 font-mono text-[10px] text-foreground">
                {e.request.toolName}
              </code>
              <DecisionPill decision={e.decision.decision} />
              <span className="text-muted-foreground/70">
                by {e.decision.decidedBy}
                {e.decision.ruleId ? ' · matched rule' : ''}
              </span>
              <div className="flex-1" />
              <time dateTime={e.decision.at} className="text-muted-foreground/60">
                {formatAuditTime(e.decision.at)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatAuditTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
