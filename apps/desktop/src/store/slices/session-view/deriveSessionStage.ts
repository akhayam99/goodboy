import type { PullRequestState, Session, SessionStageInfo } from '@goodboy/types'

type Params = {
  session: Session
  pr: PullRequestState | null
  hasUnread: boolean
  openQuestionCount: number
  hasRunningAgent?: boolean
}

const isPrLive = (pr: PullRequestState | null): pr is PullRequestState =>
  pr !== null && pr.state !== 'merged' && pr.state !== 'closed'

const isPrApproved = (pr: PullRequestState): boolean =>
  !pr.isDraft && (pr.state === 'approved' || pr.reviewDecision === 'approved')

export const deriveSessionStage = ({
  session,
  pr,
  hasUnread,
  openQuestionCount,
  hasRunningAgent = false,
}: Params): SessionStageInfo => {
  if (session.state.kind === 'error') {
    return { stage: 'attention', reason: 'agent errored' }
  }
  if (session.state.kind === 'running' || session.state.kind === 'starting') {
    return { stage: 'running', reason: 'agent running' }
  }
  if (hasRunningAgent) {
    return { stage: 'running', reason: 'agent running' }
  }
  if (isPrLive(pr) && pr.checks === 'failure') {
    return { stage: 'attention', reason: `PR #${pr.number}: CI failed` }
  }
  if (isPrLive(pr) && pr.reviewDecision === 'changes_requested') {
    return { stage: 'attention', reason: `PR #${pr.number}: changes requested` }
  }
  if (openQuestionCount === 1) {
    return { stage: 'attention', reason: '1 open question' }
  }
  if (openQuestionCount > 1) {
    return { stage: 'attention', reason: `${openQuestionCount} open questions` }
  }
  if (isPrLive(pr) && isPrApproved(pr)) {
    return { stage: 'attention', reason: `PR #${pr.number} approved, ready to merge` }
  }
  if (hasUnread) {
    return { stage: 'attention', reason: 'unread agent reply' }
  }
  if (pr === null) {
    return { stage: 'building', reason: 'no PR yet' }
  }
  if (pr.state === 'merged') {
    return { stage: 'done', reason: `PR #${pr.number} merged` }
  }
  if (pr.state === 'closed') {
    return { stage: 'done', reason: `PR #${pr.number} closed` }
  }
  if (pr.isDraft) {
    return { stage: 'review', reason: `draft PR #${pr.number}` }
  }
  if (pr.checks === 'pending') {
    return { stage: 'review', reason: `PR #${pr.number}: CI running` }
  }
  return { stage: 'review', reason: `PR #${pr.number} awaiting review` }
}
