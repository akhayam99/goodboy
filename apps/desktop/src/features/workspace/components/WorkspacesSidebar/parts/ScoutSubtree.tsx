import { Fragment } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Agent, AgentId } from '@goodboy/types'
import { EMPTY_ARRAY, agentHasUnread } from '../../../../../store'
import type { AgentAggregate } from '../../../../../features/session/components/AgentMetricsBlock'
import { ClusterChildRow } from './ClusterChildRow'

type ScoutSubtreeProps = {
  readonly containerId: AgentId
  readonly depth: number
  readonly childrenByParentId: ReadonlyMap<string, Agent[]>
  readonly aggregatesByAgentId: ReadonlyMap<string, AgentAggregate>
  readonly selectedAgentId: AgentId | null
  readonly isTaskActive: boolean
  readonly expandState: ReadonlyMap<string, boolean>
  readonly onToggle: (id: string) => void
  readonly onSelect: (id: AgentId) => void
}

export function ScoutSubtree({
  containerId,
  depth,
  childrenByParentId,
  aggregatesByAgentId,
  selectedAgentId,
  isTaskActive,
  expandState,
  onToggle,
  onSelect,
}: ScoutSubtreeProps) {
  const children = childrenByParentId.get(containerId) ?? EMPTY_ARRAY
  if (children.length === 0 || depth > 4) {
    return null
  }
  const expanded = expandState.get(containerId) ?? false
  const doneCount = children.filter(
    (c) => c.status === 'completed' || c.status === 'skipped',
  ).length
  const unreadCount = (() => {
    let n = 0
    const visit = (id: AgentId) => {
      for (const c of childrenByParentId.get(id) ?? EMPTY_ARRAY) {
        if (agentHasUnread(c, c.id === selectedAgentId && isTaskActive)) {
          n += 1
        }
        visit(c.id)
      }
    }
    visit(containerId)
    return n
  })()
  return (
    <div className="ml-3 flex flex-col gap-0.5 border-l border-border-soft/60 pl-2">
      <button
        type="button"
        onClick={() => onToggle(containerId)}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'collapse' : 'expand'} scouts`}
        className="flex items-center gap-1 px-2 py-0.5 text-2xs uppercase tracking-wide text-info/70 transition-colors hover:text-info"
      >
        {expanded ? (
          <ChevronDown size={10} aria-hidden className="shrink-0" />
        ) : (
          <ChevronRight size={10} aria-hidden className="shrink-0" />
        )}
        scouts {doneCount}/{children.length}
        {!expanded && unreadCount > 0 ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded bg-warning/15 px-1 py-0.5 text-[9px] font-medium text-warning"
            title={`${unreadCount} scout ${unreadCount === 1 ? 'reply' : 'replies'} to review`}
          >
            <span aria-hidden className="size-1 rounded-full bg-warning" />
            {unreadCount}
          </span>
        ) : null}
      </button>
      {expanded
        ? children.map((child, ci) => (
            <Fragment key={child.id}>
              <ClusterChildRow
                child={child}
                index={ci}
                total={children.length}
                costUsd={aggregatesByAgentId.get(child.id)?.estimatedCostUsd ?? 0}
                isSelected={child.id === selectedAgentId}
                isTaskActive={isTaskActive}
                onSelect={() => onSelect(child.id)}
              />
              <ScoutSubtree
                containerId={child.id}
                depth={depth + 1}
                childrenByParentId={childrenByParentId}
                aggregatesByAgentId={aggregatesByAgentId}
                selectedAgentId={selectedAgentId}
                isTaskActive={isTaskActive}
                expandState={expandState}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            </Fragment>
          ))
        : null}
    </div>
  )
}
