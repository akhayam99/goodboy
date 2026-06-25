import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionExternalTask, SessionId, WorkspaceId } from '@goodboy/types'
import {
  buildIssueRows,
  dedupById,
  resolveSentrySessions,
  useSentryIssues,
} from './useSentryIssues'
import { sentryFetchIssues } from '../client'
import type { SentryIssue, SentryIssuesPage } from '../client'

const hoisted = vi.hoisted(() => ({
  externalTasks: {} as Record<string, SessionExternalTask>,
}))

vi.mock('../client', () => ({ sentryFetchIssues: vi.fn() }))

vi.mock('../../../../store', () => ({
  useAppStore: (
    selector: (s: { sessionExternalTasks: Record<string, SessionExternalTask> }) => unknown,
  ) => selector({ sessionExternalTasks: hoisted.externalTasks }),
}))

const fetchIssues = vi.mocked(sentryFetchIssues)
const WS = 'ws-1' as WorkspaceId

const page = (issues: SentryIssue[], next_cursor: string | null = null): SentryIssuesPage => ({
  issues,
  next_cursor,
})

function makeIssue(overrides: Partial<SentryIssue> = {}): SentryIssue {
  return {
    id: 'sentry-1',
    shortId: 'GOODBOY-1',
    title: 'Boom',
    culprit: null,
    level: 'error',
    status: 'unresolved',
    count: '1',
    userCount: 1,
    firstSeen: null,
    lastSeen: null,
    permalink: null,
    metadata: null,
    ...overrides,
  }
}

describe('dedupById', () => {
  it('keeps first occurrence and drops later duplicates', () => {
    const deduped = dedupById([
      makeIssue({ id: 'a', title: 'first' }),
      makeIssue({ id: 'b' }),
      makeIssue({ id: 'a', title: 'dup' }),
    ])
    expect(deduped.map((i) => i.id)).toEqual(['a', 'b'])
    expect(deduped[0]?.title).toBe('first')
  })
})

describe('resolveSentrySessions', () => {
  it('links sentry external tasks by external id, ignoring other providers', () => {
    const tasks: Record<string, SessionExternalTask> = {
      s1: { provider: 'sentry', externalId: 'sentry-1' } as SessionExternalTask,
      s2: { provider: 'linear', externalId: 'lin-1' } as SessionExternalTask,
    }
    const map = resolveSentrySessions(tasks)
    expect(map.get('sentry-1')).toBe('s1')
    expect(map.has('lin-1')).toBe(false)
  })
})

describe('buildIssueRows', () => {
  it('attaches the linked session id when present', () => {
    const rows = buildIssueRows(
      [makeIssue({ id: 'sentry-1' }), makeIssue({ id: 'sentry-2' })],
      new Map<string, SessionId>([['sentry-1', 's1' as SessionId]]),
    )
    expect(rows.find((r) => r.issue.id === 'sentry-1')?.sessionId).toBe('s1')
    expect(rows.find((r) => r.issue.id === 'sentry-2')?.sessionId).toBeNull()
  })
})

describe('useSentryIssues', () => {
  beforeEach(() => {
    hoisted.externalTasks = {}
    fetchIssues.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('loads the first page on mount and exposes rows', async () => {
    fetchIssues.mockResolvedValueOnce(page([makeIssue({ id: 'a' })]))
    const { result } = renderHook(() => useSentryIssues(WS))

    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    expect(result.current.rows[0]?.issue.id).toBe('a')
    expect(result.current.loading).toBe(false)
    expect(result.current.hasMore).toBe(false)
    expect(fetchIssues).toHaveBeenCalledWith(WS, undefined, undefined)
  })

  it('exposes hasMore and forwards the cursor on loadMore, deduping across pages', async () => {
    fetchIssues
      .mockResolvedValueOnce(page([makeIssue({ id: 'a' }), makeIssue({ id: 'b' })], 'cur-1'))
      .mockResolvedValueOnce(page([makeIssue({ id: 'b' }), makeIssue({ id: 'c' })], null))
    const { result } = renderHook(() => useSentryIssues(WS))

    await waitFor(() => expect(result.current.rows).toHaveLength(2))
    expect(result.current.hasMore).toBe(true)

    act(() => result.current.loadMore())

    await waitFor(() => expect(result.current.rows).toHaveLength(3))
    expect(result.current.rows.map((r) => r.issue.id)).toEqual(['a', 'b', 'c'])
    expect(result.current.hasMore).toBe(false)
    expect(fetchIssues).toHaveBeenNthCalledWith(2, WS, undefined, 'cur-1')
  })

  it('does not fetch again when loadMore is called without a cursor', async () => {
    fetchIssues.mockResolvedValueOnce(page([makeIssue({ id: 'a' })], null))
    const { result } = renderHook(() => useSentryIssues(WS))

    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    fetchIssues.mockClear()
    act(() => result.current.loadMore())
    expect(fetchIssues).not.toHaveBeenCalled()
  })

  it('captures a fetch error message and stays empty', async () => {
    fetchIssues.mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useSentryIssues(WS))

    await waitFor(() => expect(result.current.error).toBe('boom'))
    expect(result.current.rows).toHaveLength(0)
    expect(result.current.loading).toBe(false)
  })

  it('stringifies a non-Error rejection', async () => {
    fetchIssues.mockRejectedValueOnce('offline')
    const { result } = renderHook(() => useSentryIssues(WS))

    await waitFor(() => expect(result.current.error).toBe('offline'))
  })

  it('refetch resets rows and reloads from the first page', async () => {
    fetchIssues
      .mockResolvedValueOnce(page([makeIssue({ id: 'a' })], 'cur-1'))
      .mockResolvedValueOnce(page([makeIssue({ id: 'z' })], null))
    const { result } = renderHook(() => useSentryIssues(WS))

    await waitFor(() => expect(result.current.rows.map((r) => r.issue.id)).toEqual(['a']))
    expect(result.current.hasMore).toBe(true)

    act(() => result.current.refetch())

    await waitFor(() => expect(result.current.rows.map((r) => r.issue.id)).toEqual(['z']))
    expect(result.current.hasMore).toBe(false)
  })

  it('cross-links rows to sessions from the store', async () => {
    hoisted.externalTasks = {
      s9: { provider: 'sentry', externalId: 'a' } as SessionExternalTask,
    }
    fetchIssues.mockResolvedValueOnce(page([makeIssue({ id: 'a' }), makeIssue({ id: 'b' })]))
    const { result } = renderHook(() => useSentryIssues(WS))

    await waitFor(() => expect(result.current.rows).toHaveLength(2))
    expect(result.current.rows.find((r) => r.issue.id === 'a')?.sessionId).toBe('s9')
    expect(result.current.rows.find((r) => r.issue.id === 'b')?.sessionId).toBeNull()
  })
})
