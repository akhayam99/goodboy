import { useCallback, useMemo, useState, type RefObject } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Agent, Session, Skill, Workflow, WorkspaceScript } from '@goodboy/types'
import { EMPTY_ARRAY, useAppStore } from '../../../../../store'
import { formatError } from '../../../../../shared/lib/errors'
import { WORKSPACE_FEATURES } from '../../../../../shared/lib/features'
import type { ToastKind } from '../../../../../app/components/Toast'
import {
  QuickActionsPopover,
  buildAgentActions,
  buildScriptActions,
  buildSkillActions,
  buildWorkflowActions,
  parseQuery,
  type QuickActionItem,
} from '../../../../quick-actions'
import { CHAT_PREFIX_RE } from '../lib'

export { QuickActionsPopover }

interface UseChatPrefixArgs {
  readonly session: Session
  readonly value: string
  readonly setValue: (next: string) => void
  readonly sessionWorktree: string | null
  readonly showToast: (kind: ToastKind, message: string) => void
  readonly wrapperRef: RefObject<HTMLDivElement | null>
}

export function useChatPrefix({
  session,
  value,
  setValue,
  sessionWorktree,
  showToast,
  wrapperRef,
}: UseChatPrefixArgs) {
  const workspaceSkills = useAppStore(
    useShallow((s) => s.skills[session.workspaceId] ?? EMPTY_ARRAY),
  )
  const workspaceScripts = useAppStore(
    useShallow((s) => s.workspaceScripts[session.workspaceId] ?? EMPTY_ARRAY),
  )
  const runScript = useAppStore((s) => s.runScript)
  const workspaceWorkflows = useAppStore(
    useShallow((s) => s.phaseTemplates[session.workspaceId] ?? EMPTY_ARRAY),
  ) as ReadonlyArray<Workflow>
  const sessionAgents = useAppStore(
    useShallow((s) => s.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY),
  ) as ReadonlyArray<Agent>
  const sessionAgentKindOverrides = useAppStore((s) => s.agentKindOverride)
  const selectAgent = useAppStore((s) => s.selectAgent)
  const attachWorkflowToSession = useAppStore((s) => s.attachWorkflowToSession)
  const spawnAgent = useAppStore((s) => s.spawnAgent)

  const [showPopover, setShowPopover] = useState(false)

  const parsed = useMemo(() => parseQuery(value), [value])
  const inPrefixMode = CHAT_PREFIX_RE.test(value)

  const onValueChange = (next: string) => {
    setValue(next)
    setShowPopover(CHAT_PREFIX_RE.test(next))
  }

  const onPickScript = useCallback(
    (script: WorkspaceScript) => {
      if (!sessionWorktree) {
        showToast('warning', `${script.name}, open a session worktree to run scripts`)
        return
      }
      setValue('')
      setShowPopover(false)
      void runScript(session.id, script.id, sessionWorktree)
    },
    [runScript, setValue, session.id, sessionWorktree, showToast],
  )

  const onPickSkill = useCallback(
    (skill: Skill) => {
      setValue(`/${skill.name} `)
      setShowPopover(false)
      wrapperRef.current?.querySelector('textarea')?.focus()
    },
    [setValue, wrapperRef],
  )

  const onPickWorkflow = useCallback(
    async (workflow: Workflow) => {
      setValue('')
      setShowPopover(false)
      try {
        await attachWorkflowToSession(session.id, workflow.id)
        showToast('success', `workflow "${workflow.name}" started`)
      } catch (err) {
        showToast('error', formatError(err))
      }
    },
    [attachWorkflowToSession, session.id, showToast, setValue],
  )

  const onSwitchAgent = useCallback(
    (agent: Agent) => {
      setValue('')
      setShowPopover(false)
      void selectAgent(session.id, agent.id)
    },
    [selectAgent, session.id, setValue],
  )

  const onSpawnAgent = useCallback(async () => {
    setValue('')
    setShowPopover(false)
    try {
      await spawnAgent(session.id, {})
      showToast('success', 'new agent spawned')
    } catch (err) {
      showToast('error', formatError(err))
    }
  }, [spawnAgent, session.id, showToast, setValue])

  const quickItems = useMemo<ReadonlyArray<QuickActionItem> | null>(() => {
    const symbol = parsed.prefix?.symbol
    if (symbol === '$') {
      return buildScriptActions(workspaceScripts, (script) => void onPickScript(script))
    }
    if (symbol === '~') {
      return buildWorkflowActions(workspaceWorkflows, (workflow) => void onPickWorkflow(workflow))
    }
    if (symbol === '@') {
      return buildAgentActions(
        sessionAgents,
        sessionAgentKindOverrides,
        onSwitchAgent,
        () => void onSpawnAgent(),
      )
    }
    if (symbol === '/' && WORKSPACE_FEATURES.skills) {
      return buildSkillActions(workspaceSkills, onPickSkill)
    }
    return null
  }, [
    parsed.prefix,
    workspaceScripts,
    workspaceWorkflows,
    sessionAgents,
    sessionAgentKindOverrides,
    workspaceSkills,
    onPickScript,
    onPickWorkflow,
    onSwitchAgent,
    onSpawnAgent,
    onPickSkill,
  ])

  const filteredQuickItems = useMemo<ReadonlyArray<QuickActionItem>>(() => {
    if (!quickItems) {
      return EMPTY_ARRAY
    }
    const q = parsed.query.toLowerCase()
    if (q.length === 0) {
      return quickItems
    }
    return quickItems.filter(
      (it) =>
        it.label.toLowerCase().includes(q) || (it.sublabel?.toLowerCase().includes(q) ?? false),
    )
  }, [quickItems, parsed.query])

  const popoverOpen = showPopover && inPrefixMode && quickItems !== null
  const quickEmptyHint =
    parsed.prefix?.symbol === '$'
      ? 'no scripts yet. add them in workspace settings'
      : parsed.prefix?.symbol === '~'
        ? 'no workflows yet. create one in workspace settings'
        : parsed.prefix?.symbol === '@'
          ? 'no agents in this session yet'
          : 'no skills yet. create one in settings'

  const onQuickActionSelect = useCallback((item: QuickActionItem) => item.perform(), [])
  const dismissPopover = useCallback(() => setShowPopover(false), [])

  return {
    onValueChange,
    popoverOpen,
    filteredQuickItems,
    quickEmptyHint,
    onQuickActionSelect,
    dismissPopover,
  }
}
