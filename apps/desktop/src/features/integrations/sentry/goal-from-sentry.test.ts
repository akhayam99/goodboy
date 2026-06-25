import { describe, expect, it } from 'vitest'
import { goalFromSentry } from './goal-from-sentry'
import type { SentryIssue, SentryIssueDetail, SentryStackFrame } from './client'

function makeIssue(overrides: Partial<SentryIssue> = {}): SentryIssue {
  return {
    id: 'sentry-1',
    shortId: 'GOODBOY-7A',
    title: 'TypeError: cannot read property foo of undefined',
    culprit: 'app/handlers/session in createSession',
    level: 'error',
    status: 'unresolved',
    count: '12',
    userCount: 3,
    firstSeen: '2026-05-01T10:00:00Z',
    lastSeen: '2026-05-21T10:00:00Z',
    permalink: 'https://sentry.io/organizations/goodboy/issues/1/',
    metadata: null,
    ...overrides,
  }
}

function frame(overrides: Partial<SentryStackFrame> = {}): SentryStackFrame {
  return {
    filename: 'src/store/createSession.ts',
    function: 'createSession',
    line_no: 88,
    in_app: true,
    ...overrides,
  }
}

describe('goalFromSentry', () => {
  it('builds heading + culprit when no detail', () => {
    expect(goalFromSentry(makeIssue())).toBe(
      '[GOODBOY-7A] TypeError: cannot read property foo of undefined\n\napp/handlers/session in createSession',
    )
  })

  it('falls back to id when shortId is null and heading-only when nothing else', () => {
    expect(goalFromSentry(makeIssue({ shortId: null, culprit: null }))).toBe(
      '[sentry-1] TypeError: cannot read property foo of undefined',
    )
  })

  it('appends top stack frames from detail', () => {
    const detail: SentryIssueDetail = {
      title: null,
      culprit: 'app/x',
      frames: [frame(), frame({ function: 'caller', line_no: 12 })],
    }
    const goal = goalFromSentry(makeIssue(), detail)
    expect(goal).toContain('app/x')
    expect(goal).toContain('  at createSession (src/store/createSession.ts:88)')
    expect(goal).toContain('  at caller (src/store/createSession.ts:12)')
  })

  it('prefers in-app frames over library frames', () => {
    const detail: SentryIssueDetail = {
      title: null,
      culprit: null,
      frames: [
        frame({ function: 'libCall', in_app: false }),
        frame({ function: 'appCall', in_app: true }),
      ],
    }
    const goal = goalFromSentry(makeIssue({ culprit: null }), detail)
    expect(goal).toContain('appCall')
    expect(goal).not.toContain('libCall')
  })

  it('caps an overlong body and prefers detail title', () => {
    const detail: SentryIssueDetail = {
      title: 'Detail title',
      culprit: 'x'.repeat(2000),
      frames: [],
    }
    const goal = goalFromSentry(makeIssue(), detail)
    expect(goal.startsWith('[GOODBOY-7A] Detail title')).toBe(true)
    expect(goal.endsWith('…')).toBe(true)
    expect(goal.length).toBeLessThanOrEqual(1300)
  })

  it('falls back to all frames when none are marked in-app', () => {
    const detail: SentryIssueDetail = {
      title: null,
      culprit: null,
      frames: [
        frame({ function: 'libA', in_app: false }),
        frame({ function: 'libB', in_app: false }),
      ],
    }
    const goal = goalFromSentry(makeIssue({ culprit: null }), detail)
    expect(goal).toContain('libA')
    expect(goal).toContain('libB')
  })

  it('caps the stack at ten frames', () => {
    const frames = Array.from({ length: 15 }, (_, i) => frame({ function: `fn${i}`, line_no: i }))
    const goal = goalFromSentry(makeIssue({ culprit: null }), {
      title: null,
      culprit: null,
      frames,
    })
    const stackLines = goal.split('\n').filter((l) => l.startsWith('  at '))
    expect(stackLines).toHaveLength(10)
    expect(goal).toContain('fn0')
    expect(goal).toContain('fn9')
    expect(goal).not.toContain('fn10')
  })

  it('renders a missing filename and line number as placeholders', () => {
    const goal = goalFromSentry(makeIssue({ culprit: null }), {
      title: null,
      culprit: null,
      frames: [frame({ function: null, filename: null, line_no: null })],
    })
    expect(goal).toContain('  at ? (?)')
  })

  it('returns heading only when detail has no culprit and no frames', () => {
    const goal = goalFromSentry(makeIssue({ shortId: 'GB-9', culprit: null }), {
      title: null,
      culprit: null,
      frames: [],
    })
    expect(goal).toBe('[GB-9] TypeError: cannot read property foo of undefined')
  })

  it('trims surrounding whitespace from the title', () => {
    const goal = goalFromSentry(makeIssue({ title: '  Spacey error  ', culprit: null }))
    expect(goal).toBe('[GOODBOY-7A] Spacey error')
  })
})
