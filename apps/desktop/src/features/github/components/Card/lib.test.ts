import { describe, expect, it } from 'vitest'
import type { PrCheckRun, PrComment, PrDetail, PrReview, PullRequestState } from '@goodboy/types'
import { formatDuration, formatRelative, latestTerminalReviewsByAuthor, pickSmartTab } from './lib'

const makePr = (over: Partial<PullRequestState> = {}): PullRequestState => ({
  number: 1,
  title: 'pr',
  url: 'https://example.test/pr/1',
  state: 'open',
  mergeable: true,
  checks: null,
  baseBranch: 'main',
  headBranch: 'feat',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-05-01T00:00:00.000Z',
  ...over,
})

const makeReview = (over: Partial<PrReview> = {}): PrReview => ({
  id: 'r1',
  author: 'alice',
  authorAvatarUrl: null,
  state: 'approved',
  submittedAt: '2026-05-01T00:00:00.000Z',
  body: '',
  ...over,
})

const makeComment = (over: Partial<PrComment> = {}): PrComment => ({
  id: 'c1',
  author: 'alice',
  authorAvatarUrl: null,
  body: 'hi',
  createdAt: '2026-05-01T00:00:00.000Z',
  url: 'https://example.test/c/1',
  source: 'issue',
  ...over,
})

const makeCheck = (over: Partial<PrCheckRun> = {}): PrCheckRun => ({
  name: 'build',
  conclusion: 'success',
  detailsUrl: null,
  durationMs: null,
  ...over,
})

const makeDetail = (over: Partial<PrDetail> = {}): PrDetail => ({
  prNumber: 1,
  comments: [],
  reviews: [],
  reviewRequests: [],
  checks: [],
  ...over,
})

describe('latestTerminalReviewsByAuthor', () => {
  it('drops non-terminal review states', () => {
    const reviews = [
      makeReview({ state: 'commented' }),
      makeReview({ state: 'pending' }),
      makeReview({ state: 'dismissed' }),
    ]
    expect(latestTerminalReviewsByAuthor(reviews)).toEqual([])
  })

  it('keeps the latest terminal review per author', () => {
    const reviews = [
      makeReview({ author: 'alice', state: 'approved', submittedAt: '2026-05-01T00:00:00.000Z' }),
      makeReview({
        author: 'alice',
        state: 'changes_requested',
        submittedAt: '2026-05-02T00:00:00.000Z',
      }),
    ]
    const result = latestTerminalReviewsByAuthor(reviews)
    expect(result).toHaveLength(1)
    expect(result[0]?.state).toBe('changes_requested')
  })

  it('keeps one entry per distinct author', () => {
    const reviews = [
      makeReview({ author: 'alice', state: 'approved' }),
      makeReview({ author: 'bob', state: 'changes_requested' }),
    ]
    expect(latestTerminalReviewsByAuthor(reviews)).toHaveLength(2)
  })
})

describe('pickSmartTab', () => {
  it('returns "ci" when a detail check is failing', () => {
    const detail = makeDetail({ checks: [makeCheck({ conclusion: 'failure' })] })
    expect(pickSmartTab(makePr(), detail, null)).toBe('ci')
  })

  it('returns "ci" when a detail check is pending', () => {
    const detail = makeDetail({ checks: [makeCheck({ conclusion: 'pending' })] })
    expect(pickSmartTab(makePr(), detail, null)).toBe('ci')
  })

  it('returns "ci" from pr.checks when no detail is available', () => {
    expect(pickSmartTab(makePr({ checks: 'failure' }), null, null)).toBe('ci')
  })

  it('returns "review" when a terminal review requests changes', () => {
    const detail = makeDetail({ reviews: [makeReview({ state: 'changes_requested' })] })
    expect(pickSmartTab(makePr(), detail, null)).toBe('review')
  })

  it('returns "review" when pr.reviewDecision requests changes', () => {
    expect(pickSmartTab(makePr({ reviewDecision: 'changes_requested' }), null, null)).toBe('review')
  })

  it('returns "comments" when the newest comment is newer than branch activity', () => {
    const detail = makeDetail({
      comments: [makeComment({ createdAt: '2026-05-10T00:00:00.000Z' })],
    })
    expect(pickSmartTab(makePr(), detail, '2026-05-01T00:00:00.000Z')).toBe('comments')
  })

  it('ignores comments older than branch activity', () => {
    const detail = makeDetail({
      comments: [makeComment({ createdAt: '2026-04-01T00:00:00.000Z' })],
    })
    expect(pickSmartTab(makePr(), detail, '2026-05-01T00:00:00.000Z')).toBe('ci')
  })

  it('defaults to "ci" for a clean pr', () => {
    expect(pickSmartTab(makePr(), makeDetail(), null)).toBe('ci')
  })
})

describe('formatDuration', () => {
  it('returns "" for null', () => {
    expect(formatDuration(null)).toBe('')
  })

  it('formats sub-second values in ms', () => {
    expect(formatDuration(500)).toBe('500ms')
  })

  it('rounds to seconds at the one-second boundary', () => {
    expect(formatDuration(1_000)).toBe('1s')
  })

  it('formats whole seconds under a minute', () => {
    expect(formatDuration(5_000)).toBe('5s')
  })

  it('formats minutes with a seconds remainder', () => {
    expect(formatDuration(90_000)).toBe('1m 30s')
  })

  it('omits the seconds remainder on a whole minute', () => {
    expect(formatDuration(120_000)).toBe('2m')
  })
})

describe('formatRelative', () => {
  it('returns "just now" for negative input', () => {
    expect(formatRelative(-5)).toBe('just now')
  })

  it('returns "just now" for non-finite input', () => {
    expect(formatRelative(Number.POSITIVE_INFINITY)).toBe('just now')
    expect(formatRelative(Number.NaN)).toBe('just now')
  })

  it('returns "just now" under 45 seconds', () => {
    expect(formatRelative(30_000)).toBe('just now')
  })

  it('formats minutes', () => {
    expect(formatRelative(300_000)).toBe('5m ago')
  })

  it('formats hours', () => {
    expect(formatRelative(7_200_000)).toBe('2h ago')
  })

  it('formats days', () => {
    expect(formatRelative(259_200_000)).toBe('3d ago')
  })
})
