import { useCallback, useMemo, useState, type RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, Session, Skill, Workflow } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../../store';
import type { ShowToast } from '../../../../../../app/components/Toast';
import {
  buildAgentActions,
  buildScriptActions,
  buildSkillActions,
  buildWorkflowActions,
  parseQuery,
  type QuickActionItem,
} from '../../../../../quick-actions';
import type { ScriptPick } from '../../../../../quick-actions/registry';
import { scriptEmptyHint } from '../../../../../quick-actions/scriptEmptyHint';
import { discoveredScriptCwd } from '../../../../../scripts/scripts';
import { useSessionScripts } from '../../../../../scripts/hooks/useSessionScripts';
import { CHAT_PREFIX_RE } from '../../lib';

const NO_RUNS: Readonly<Record<string, { readonly status: string }>> = {};

const QUICK_EMPTY_HINT: Readonly<Record<string, string>> = {
  '~': 'no workflows yet. create one in workspace settings',
  '@': 'no agents in this session yet',
  '/': 'no skills yet. create one in settings',
};

type Params = {
  readonly session: Session;
  readonly value: string;
  readonly setValue: (next: string) => void;
  readonly showToast: ShowToast;
  readonly wrapperRef: RefObject<HTMLDivElement | null>;
};

export const useChatPrefix = ({ session, value, setValue, showToast, wrapperRef }: Params) => {
  const workspaceSkills = useAppStore(
    useShallow((s) => s.skills[session.workspaceId] ?? EMPTY_ARRAY),
  );
  const runScript = useAppStore((s) => s.runScript);
  const runDiscoveredScript = useAppStore((s) => s.runDiscoveredScript);
  const openDrawer = useAppStore((s) => s.openDrawer);
  const scriptRuns = useAppStore((s) => s.scriptRuns[session.id] ?? NO_RUNS);
  const workspaceWorkflows = useAppStore(
    useShallow((s) => s.phaseTemplates[session.workspaceId] ?? EMPTY_ARRAY),
  ) as ReadonlyArray<Workflow>;
  const sessionAgents = useAppStore(
    useShallow((s) => s.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY),
  ) as ReadonlyArray<Agent>;
  const sessionAgentKindOverrides = useAppStore((s) => s.agentKindOverride);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const attachWorkflowToSession = useAppStore((s) => s.attachWorkflowToSession);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const reportError = useAppStore((s) => s.reportError);

  const [showPopover, setShowPopover] = useState(false);

  const parsed = useMemo(() => parseQuery(value), [value]);
  const inPrefixMode = CHAT_PREFIX_RE.test(value);
  const sessionScripts = useSessionScripts({
    sessionId: session.id,
    workspaceId: session.workspaceId,
    shouldScan: parsed.prefix?.symbol === '$',
  });
  const runningScriptKeys = useMemo(
    () =>
      new Set(
        Object.entries(scriptRuns).flatMap(([key, run]) => (run.status === 'pending' ? [key] : [])),
      ),
    [scriptRuns],
  );

  const onValueChange = (next: string) => {
    setValue(next);
    setShowPopover(CHAT_PREFIX_RE.test(next));
  };

  const onPickScript = useCallback(
    ({ script, group }: ScriptPick) => {
      setValue('');
      setShowPopover(false);
      openDrawer({
        kind: 'scriptRun',
        sessionId: session.id,
        payload: { scriptKey: script.key, mountId: group.mountId },
      });
      if (script.savedId !== null) {
        void runScript({ sessionId: session.id, scriptId: script.savedId, mountId: group.mountId });
        return;
      }
      void runDiscoveredScript({
        sessionId: session.id,
        scriptId: script.key,
        name: script.name,
        command: script.invocation,
        cwd: discoveredScriptCwd({ worktreePath: group.worktreePath, relDir: script.relDir }),
        mountId: group.mountId,
      });
    },
    [openDrawer, runDiscoveredScript, runScript, setValue, session.id],
  );

  const onPickSkill = useCallback(
    (skill: Skill) => {
      setValue(`/${skill.name} `);
      setShowPopover(false);
      wrapperRef.current?.querySelector('textarea')?.focus();
    },
    [setValue, wrapperRef],
  );

  const onPickWorkflow = useCallback(
    async (workflow: Workflow) => {
      setValue('');
      setShowPopover(false);
      try {
        await attachWorkflowToSession(session.id, workflow.id, { navigate: true });
        showToast({ kind: 'success', message: `Started ${workflow.name}.` });
      } catch (error) {
        void reportError({
          title: `Couldn't start ${workflow.name}`,
          error,
          sessionId: session.id,
        });
      }
    },
    [attachWorkflowToSession, reportError, session.id, showToast, setValue],
  );

  const onSwitchAgent = useCallback(
    (agent: Agent) => {
      setValue('');
      setShowPopover(false);
      void selectAgent(session.id, agent.id);
    },
    [selectAgent, session.id, setValue],
  );

  const onSpawnAgent = useCallback(async () => {
    setValue('');
    setShowPopover(false);
    try {
      await spawnAgent(session.id, { focus: 'agent' });
      showToast({ kind: 'success', message: 'Started a new agent.' });
    } catch (error) {
      void reportError({ title: "Couldn't start a new agent", error, sessionId: session.id });
    }
  }, [reportError, spawnAgent, session.id, showToast, setValue]);

  const quickItems = useMemo<ReadonlyArray<QuickActionItem> | null>(() => {
    const symbol = parsed.prefix?.symbol;
    if (symbol === '$') {
      return buildScriptActions({
        groups: sessionScripts.groups,
        runningKeys: runningScriptKeys,
        onPick: onPickScript,
      });
    }
    if (symbol === '~') {
      return buildWorkflowActions(workspaceWorkflows, (workflow) => void onPickWorkflow(workflow));
    }
    if (symbol === '@') {
      return buildAgentActions(
        sessionAgents,
        sessionAgentKindOverrides,
        onSwitchAgent,
        () => void onSpawnAgent(),
      );
    }
    if (symbol === '/') {
      return buildSkillActions(workspaceSkills, onPickSkill);
    }
    return null;
  }, [
    parsed.prefix,
    sessionScripts.groups,
    runningScriptKeys,
    workspaceWorkflows,
    sessionAgents,
    sessionAgentKindOverrides,
    workspaceSkills,
    onPickScript,
    onPickWorkflow,
    onSwitchAgent,
    onSpawnAgent,
    onPickSkill,
  ]);

  const filteredQuickItems = useMemo<ReadonlyArray<QuickActionItem>>(() => {
    if (!quickItems) {
      return EMPTY_ARRAY;
    }
    const q = parsed.query.toLowerCase();
    if (q.length === 0) {
      return quickItems;
    }
    return quickItems.filter(
      (it) =>
        it.label.toLowerCase().includes(q) || (it.sublabel?.toLowerCase().includes(q) ?? false),
    );
  }, [quickItems, parsed.query]);

  const popoverOpen = showPopover && inPrefixMode && quickItems !== null;
  const quickEmptyHint =
    parsed.prefix?.symbol === '$'
      ? scriptEmptyHint({
          groups: sessionScripts.groups,
          query: parsed.query,
          isReading: sessionScripts.isReading,
        })
      : (QUICK_EMPTY_HINT[parsed.prefix?.symbol ?? ''] ?? '');

  const onQuickActionSelect = useCallback((item: QuickActionItem) => item.perform(), []);
  const dismissPopover = useCallback(() => setShowPopover(false), []);

  return {
    onValueChange,
    popoverOpen,
    filteredQuickItems,
    quickEmptyHint,
    onQuickActionSelect,
    dismissPopover,
  };
};
