import { useEffect, useMemo, useState } from 'react'
import { cn, Divider } from '@goodboy/ui'
import { RefreshCw } from 'lucide-react'
import type { WorkspaceId } from '@goodboy/types'
import { StudioShell } from '../../../../shared/components/StudioShell'
import { IssueInbox } from './IssueInbox'
import { IssueDetailPanel } from './IssueDetailPanel'
import { useGitlabIssues } from './useGitlabIssues'
import type { GitlabIssue } from '../client'

type Props = {
  readonly workspaceId: WorkspaceId
  readonly workspaceName: string
  readonly initialIssueId?: string | null
  readonly onClose: () => void
}

export const GitlabStudio = ({ workspaceId, workspaceName, initialIssueId, onClose }: Props) => {
  const { groups, loading, error, refetch } = useGitlabIssues(workspaceId)
  const [focused, setFocused] = useState<GitlabIssue | null>(null)

  useEffect(() => {
    if (focused !== null) {
      return
    }
    if (initialIssueId) {
      for (const group of groups) {
        const row = group.rows.find((r) => String(r.issue.id) === initialIssueId)
        if (row) {
          setFocused(row.issue)
          return
        }
      }
    }
    const first = groups[0]?.rows[0]?.issue ?? null
    if (first) {
      setFocused(first)
    }
  }, [focused, groups, initialIssueId])

  const focusedRow = useMemo(() => {
    if (!focused) {
      return null
    }
    for (const group of groups) {
      const row = group.rows.find((r) => r.issue.id === focused.id)
      if (row) {
        return row
      }
    }
    return null
  }, [focused, groups])

  return (
    <StudioShell
      glyph={
        <span className="flex size-8 items-center justify-center rounded-lg bg-provider-gitlab/10">
          <span className="flex size-4 items-center justify-center rounded-sm bg-provider-gitlab text-[9px] font-bold text-white">
            G
          </span>
        </span>
      }
      title="GitLab"
      workspaceName={workspaceName}
      closeLabel="close gitlab studio"
      headerAccessory={
        <button
          type="button"
          onClick={refetch}
          disabled={loading}
          title="Refresh issues"
          aria-label="Refresh issues"
          className={cn(
            'inline-flex items-center justify-center rounded-md border border-border-soft p-1.5',
            'text-muted-foreground transition-colors',
            'hover:border-border hover:bg-muted/50 hover:text-foreground disabled:opacity-50',
          )}
        >
          <RefreshCw size={13} aria-hidden />
        </button>
      }
      onClose={onClose}
    >
      {(requestClose) => (
        <>
          <div className="w-72 shrink-0">
            <IssueInbox
              groups={groups}
              focusedIssueId={focused?.id ?? null}
              onSelect={setFocused}
              loading={loading}
              error={error}
            />
          </div>
          <Divider orientation="vertical" />
          <div className="min-h-0 flex-1">
            <IssueDetailPanel
              issue={focused}
              sessionId={focusedRow?.sessionId ?? null}
              workspaceId={workspaceId}
              onClose={requestClose}
            />
          </div>
        </>
      )}
    </StudioShell>
  )
}
