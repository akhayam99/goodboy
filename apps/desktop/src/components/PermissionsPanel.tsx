import { useEffect, useState } from 'react';
import { Button, Input } from '@kay-am/ui';
import type { PermissionDecisionKind, PermissionRule, PermissionRuleScope } from '@kay-am/types';
import { formatToolPattern } from '@kay-am/core';
import type { PermissionRuleId } from '@kay-am/types';
import {
  invokePermissionRuleList,
  invokePermissionRuleUpsert,
  invokePermissionRuleDelete,
} from '../permissions';
import { useCurrentSession, useCurrentWorkspace } from '../store';

const TOOL_NAMES = [
  'Bash',
  'Edit',
  'Write',
  'MultiEdit',
  'Read',
  'Glob',
  'Grep',
  'NotebookEdit',
  'WebFetch',
  'WebSearch',
  'Task',
  'TodoWrite',
];

const DECISION_OPTIONS: PermissionDecisionKind[] = ['allow', 'deny', 'ask'];

const DECISION_BADGE: Record<PermissionDecisionKind, string> = {
  allow: 'bg-success/15 text-success',
  deny: 'bg-danger/15 text-danger',
  ask: 'bg-warning/15 text-warning',
};

type ScopeTab = PermissionRuleScope;

interface RuleForm {
  tool: string;
  argsMatcher: string;
  decision: PermissionDecisionKind;
  priority: string;
}

const emptyForm = (): RuleForm => ({
  tool: '',
  argsMatcher: '',
  decision: 'allow',
  priority: '0',
});

function computePreview(form: RuleForm): string {
  const tool = form.tool.trim();
  if (!tool) return '';
  const rendered = formatToolPattern({
    tool,
    ...(form.argsMatcher.trim() ? { argsMatcher: form.argsMatcher.trim() } : {}),
  });
  if (form.decision === 'allow') return `--allowedTools "${rendered}"`;
  if (form.decision === 'deny') return `--disallowedTools "${rendered}"`;
  return `(ask — no flag emitted for "${rendered}")`;
}

export function PermissionsPanel() {
  const workspace = useCurrentWorkspace();
  const session = useCurrentSession();

  const [scope, setScope] = useState<ScopeTab>('global');
  const [rules, setRules] = useState<ReadonlyArray<PermissionRule>>([]);
  const [loading, setLoading] = useState(false);
  const [editingRule, setEditingRule] = useState<PermissionRule | 'new' | null>(null);
  const [form, setForm] = useState<RuleForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<PermissionRuleId | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const showNonClaudeBanner =
    scope === 'session' &&
    session !== null &&
    session.providerPreference.defaultProvider !== 'anthropic' &&
    !bannerDismissed;

  const canLoadScope =
    scope === 'global' ||
    (scope === 'workspace' && workspace !== null) ||
    (scope === 'session' && session !== null);

  const loadRules = async () => {
    if (!canLoadScope) {
      setRules([]);
      return;
    }
    setLoading(true);
    try {
      const list = await invokePermissionRuleList({
        scope,
        ...(scope === 'workspace' && workspace ? { workspaceId: workspace.id } : {}),
        ...(scope === 'session' && session ? { sessionId: session.id } : {}),
      });
      setRules(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, workspace?.id, session?.id]);

  const openNew = () => {
    setEditingRule('new');
    setForm(emptyForm());
    setFormError(null);
  };

  const openEdit = (rule: PermissionRule) => {
    setEditingRule(rule);
    setForm({
      tool: rule.pattern.tool,
      argsMatcher: rule.pattern.argsMatcher ?? '',
      decision: rule.decision,
      priority: String(rule.priority),
    });
    setFormError(null);
  };

  const cancelEdit = () => {
    setEditingRule(null);
    setFormError(null);
  };

  const onSave = async () => {
    const tool = form.tool.trim();
    if (!tool) {
      setFormError('tool pattern is required');
      return;
    }
    const priority = parseInt(form.priority, 10);
    if (isNaN(priority)) {
      setFormError('priority must be an integer');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const existingId = editingRule !== 'new' && editingRule ? editingRule.id : undefined;
      await invokePermissionRuleUpsert({
        ...(existingId ? { id: existingId } : {}),
        scope,
        ...(scope === 'workspace' && workspace ? { workspaceId: workspace.id } : {}),
        ...(scope === 'session' && session ? { sessionId: session.id } : {}),
        patternTool: tool,
        ...(form.argsMatcher.trim() ? { patternArgsMatcher: form.argsMatcher.trim() } : {}),
        decision: form.decision,
        priority,
      });
      setEditingRule(null);
      await loadRules();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const onDeleteConfirm = async (id: PermissionRuleId) => {
    await invokePermissionRuleDelete(id);
    setPendingDeleteId(null);
    await loadRules();
  };

  if (editingRule !== null) {
    return (
      <RuleEditor
        form={form}
        onChange={setForm}
        onSave={() => void onSave()}
        onCancel={cancelEdit}
        saving={saving}
        error={formError}
        isNew={editingRule === 'new'}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-foreground">permission rules</div>
        {canLoadScope && (
          <Button variant="ghost" size="sm" onClick={openNew}>
            add rule
          </Button>
        )}
      </div>

      <ScopeTabs
        current={scope}
        onChange={(s) => {
          setScope(s);
          setBannerDismissed(false);
        }}
      />

      {showNonClaudeBanner && (
        <div className="flex items-start justify-between gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] text-warning">
          <span>
            permission proxy is currently claude-only. rules saved here will not affect cursor/codex
            turns until v0.7.
          </span>
          <button
            type="button"
            className="shrink-0 underline hover:opacity-80"
            onClick={() => setBannerDismissed(true)}
          >
            dismiss
          </button>
        </div>
      )}

      {scope === 'workspace' && !workspace && (
        <p className="text-[11px] text-muted-foreground">
          select a workspace to manage workspace rules.
        </p>
      )}
      {scope === 'session' && !session && (
        <p className="text-[11px] text-muted-foreground">
          select a session to manage session rules.
        </p>
      )}

      {canLoadScope && !loading && rules.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          no rules for this scope. add one to control which tools claude can use.
        </p>
      )}

      {canLoadScope && rules.length > 0 && (
        <ul className="flex flex-col divide-y divide-border-soft overflow-hidden rounded-md border border-border-soft bg-subtle shadow-sm">
          {rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              onEdit={() => openEdit(rule)}
              onDelete={() => setPendingDeleteId(rule.id)}
            />
          ))}
        </ul>
      )}

      {pendingDeleteId !== null && (
        <DeleteConfirm
          onConfirm={() => void onDeleteConfirm(pendingDeleteId)}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  );
}

function ScopeTabs({ current, onChange }: { current: ScopeTab; onChange: (s: ScopeTab) => void }) {
  const tabs: ScopeTab[] = ['global', 'workspace', 'session'];
  return (
    <div className="flex gap-1">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
            current === tab
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

function RuleRow({
  rule,
  onEdit,
  onDelete,
}: {
  rule: PermissionRule;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const rendered = formatToolPattern(rule.pattern);
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 text-xs">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-mono font-medium">{rendered}</span>
        <span className="text-[10px] text-muted-foreground">priority {rule.priority}</span>
      </div>
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${DECISION_BADGE[rule.decision]}`}
      >
        {rule.decision}
      </span>
      <button
        type="button"
        className="shrink-0 text-[11px] text-muted-foreground underline hover:text-foreground"
        onClick={onEdit}
      >
        edit
      </button>
      <button
        type="button"
        className="shrink-0 text-[11px] text-muted-foreground underline hover:text-danger"
        onClick={onDelete}
      >
        delete
      </button>
    </li>
  );
}

function DeleteConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2.5 text-[11px]">
      <span className="text-foreground">delete this rule?</span>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          cancel
        </Button>
        <Button size="sm" onClick={onConfirm}>
          delete
        </Button>
      </div>
    </div>
  );
}

function RuleEditor({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
  error,
  isNew,
}: {
  form: RuleForm;
  onChange: (f: RuleForm) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  isNew: boolean;
}) {
  const preview = computePreview(form);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestions = TOOL_NAMES.filter((t) =>
    t.toLowerCase().startsWith(form.tool.toLowerCase()),
  ).filter((t) => t !== form.tool);

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-semibold text-foreground">
        {isNew ? 'add rule' : 'edit rule'}
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border-soft bg-subtle p-3">
        <div className="relative flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-foreground">tool pattern</label>
          <Input
            value={form.tool}
            onChange={(e) => {
              onChange({ ...form, tool: e.target.value });
              setShowSuggestions(true);
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Bash"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-10 mt-0.5 overflow-hidden rounded-md border border-border-soft bg-background shadow-md">
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
                    onMouseDown={() => {
                      onChange({ ...form, tool: s });
                      setShowSuggestions(false);
                    }}
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-foreground">
            args matcher <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input
            value={form.argsMatcher}
            onChange={(e) => onChange({ ...form, argsMatcher: e.target.value })}
            placeholder="git:* or /path/to/file"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-foreground">decision</label>
            <select
              className="w-full rounded-md border border-border-soft bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.decision}
              onChange={(e) =>
                onChange({ ...form, decision: e.target.value as PermissionDecisionKind })
              }
            >
              {DECISION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-foreground">priority</label>
            <Input
              type="number"
              step="1"
              placeholder="0"
              value={form.priority}
              onChange={(e) => onChange({ ...form, priority: e.target.value })}
            />
          </div>
        </div>

        {preview && (
          <div className="rounded bg-muted px-2.5 py-2 font-mono text-[10px] text-muted-foreground">
            renders as: <span className="text-foreground">{preview}</span>
          </div>
        )}

        {error && <p className="text-[11px] text-danger">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? 'saving…' : 'save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
