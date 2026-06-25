import { useMemo } from 'react'
import type { PullRequestState, Session, SessionPrGroup } from '@goodboy/types'
import { useAppStore, useSessions } from '../../../../store'

export type InboxRow = {
  readonly session: Session
  readonly pr: PullRequestState | null
  readonly attention: boolean
}

export type InboxGroup = {
  readonly key: SessionPrGroup
  readonly label: string
  readonly rows: ReadonlyArray<InboxRow>
}

function bucketOf(pr: PullRequestState | null): SessionPrGroup {
  if (!pr) {
    return 'not-open'
  }
  if (pr.state === 'closed') {
    return 'closed'
  }
  if (pr.state === 'merged') {
    return 'merged'
  }
  if (pr.state === 'queued') {
    return 'queued'
  }
  if (pr.isDraft) {
    return 'draft'
  }
  if (pr.reviewDecision === 'approved') {
    return 'reviewed'
  }
  return 'reviewable'
}

function needsAttention(pr: PullRequestState | null): boolean {
  if (!pr || pr.state === 'merged' || pr.state === 'closed') {
    return false
  }
  return pr.checks === 'failure' || pr.reviewDecision === 'changes_requested'
}

const GROUP_ORDER: ReadonlyArray<SessionPrGroup> = [
  'not-open',
  'draft',
  'reviewable',
  'reviewed',
  'queued',
  'closed',
  'merged',
]

const GROUP_LABEL: Record<SessionPrGroup, string> = {
  'not-open': 'No PR yet',
  draft: 'Draft',
  reviewable: 'In review',
  reviewed: 'Approved',
  queued: 'In queue',
  closed: 'Closed',
  merged: 'Merged',
}

export const useGithubInbox = (): ReadonlyArray<InboxGroup> => {
  const sessions = useSessions()
  const githubMap = useAppStore((s) => s.sessionGithub)

  return useMemo(() => {
    const buckets = new Map<SessionPrGroup, InboxRow[]>()
    for (const session of sessions) {
      const pr = githubMap[session.id]?.pr ?? null
      const row: InboxRow = { session, pr, attention: needsAttention(pr) }
      const key = bucketOf(pr)
      const arr = buckets.get(key)
      if (arr) {
        arr.push(row)
      } else {
        buckets.set(key, [row])
      }
    }
    const sortRows = (rows: InboxRow[]): InboxRow[] =>
      rows.sort((a, b) => {
        if (a.attention !== b.attention) {
          return a.attention ? -1 : 1
        }
        return b.session.updatedAt.localeCompare(a.session.updatedAt)
      })
    return GROUP_ORDER.filter((key) => buckets.has(key)).map((key) => ({
      key,
      label: GROUP_LABEL[key],
      rows: sortRows(buckets.get(key)!),
    }))
  }, [sessions, githubMap])
}
