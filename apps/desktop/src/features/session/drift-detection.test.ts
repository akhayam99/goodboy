import { describe, expect, it } from 'vitest'
import { detectDrift } from './drift-detection'
import type { AgentKind } from './agent-kind'

describe('detectDrift', () => {
  describe('plan-marker-from-non-planner', () => {
    it('flags <<plan>> from a scout', () => {
      const result = detectDrift({
        agentKind: 'scout',
        assistantText: 'here is the result\n<<plan>>\ntitle\nsteps\n<</plan>>',
        filesEdited: [],
      })
      expect(result).toHaveLength(1)
      expect(result[0]!.signal).toBe('plan-marker-from-non-planner')
    })

    it('allows <<plan>> from a planner', () => {
      const result = detectDrift({
        agentKind: 'planner',
        assistantText: '<<plan>>\ntitle\nsteps\n<</plan>>',
        filesEdited: [],
      })
      expect(result).toHaveLength(0)
    })

    it('allows <<plan>> from generic', () => {
      const result = detectDrift({
        agentKind: 'generic',
        assistantText: '<<plan>>\ntitle\n<</plan>>',
        filesEdited: [],
      })
      expect(result).toHaveLength(0)
    })

    it('flags <<plan>> from implementer', () => {
      const result = detectDrift({
        agentKind: 'implementer',
        assistantText: '<<plan>>\nnew plan\n<</plan>>',
        filesEdited: [],
      })
      expect(result).toHaveLength(1)
      expect(result[0]!.signal).toBe('plan-marker-from-non-planner')
    })

    it('flags <<plan>> from reviewer', () => {
      const result = detectDrift({
        agentKind: 'reviewer',
        assistantText: '<<plan>>\nreview plan\n<</plan>>',
        filesEdited: [],
      })
      expect(result).toHaveLength(1)
      expect(result[0]!.signal).toBe('plan-marker-from-non-planner')
    })
  })

  describe('file-edit-from-readonly-kind', () => {
    it('flags file edits from scout', () => {
      const result = detectDrift({
        agentKind: 'scout',
        assistantText: 'done',
        filesEdited: ['src/foo.ts'],
      })
      expect(result.some((v) => v.signal === 'file-edit-from-readonly-kind')).toBe(true)
    })

    it('flags file edits from planner', () => {
      const result = detectDrift({
        agentKind: 'planner',
        assistantText: 'done',
        filesEdited: ['src/bar.ts'],
      })
      expect(result.some((v) => v.signal === 'file-edit-from-readonly-kind')).toBe(true)
    })

    it('flags file edits from reviewer', () => {
      const result = detectDrift({
        agentKind: 'reviewer',
        assistantText: 'done',
        filesEdited: ['src/baz.ts'],
      })
      expect(result.some((v) => v.signal === 'file-edit-from-readonly-kind')).toBe(true)
    })

    it('allows file edits from implementer', () => {
      const result = detectDrift({
        agentKind: 'implementer',
        assistantText: 'done',
        filesEdited: ['src/foo.ts'],
      })
      expect(result.some((v) => v.signal === 'file-edit-from-readonly-kind')).toBe(false)
    })

    it('allows file edits from debugger', () => {
      const result = detectDrift({
        agentKind: 'debugger',
        assistantText: 'done',
        filesEdited: ['src/foo.ts'],
      })
      expect(result.some((v) => v.signal === 'file-edit-from-readonly-kind')).toBe(false)
    })

    it('allows file edits from tester', () => {
      const result = detectDrift({
        agentKind: 'tester',
        assistantText: 'done',
        filesEdited: ['src/foo.test.ts'],
      })
      expect(result.some((v) => v.signal === 'file-edit-from-readonly-kind')).toBe(false)
    })

    it('allows .md edits from docs', () => {
      const result = detectDrift({
        agentKind: 'docs',
        assistantText: 'done',
        filesEdited: ['README.md', 'docs/guide.mdx'],
      })
      expect(result.some((v) => v.signal === 'file-edit-from-readonly-kind')).toBe(false)
    })

    it('flags .ts edits from docs', () => {
      const result = detectDrift({
        agentKind: 'docs',
        assistantText: 'done',
        filesEdited: ['src/main.ts'],
      })
      expect(result.some((v) => v.signal === 'file-edit-from-readonly-kind')).toBe(true)
    })

    it('allows mixed doc+non-doc edits from docs, flags only non-doc', () => {
      const result = detectDrift({
        agentKind: 'docs',
        assistantText: 'done',
        filesEdited: ['README.md', 'src/main.ts'],
      })
      const violation = result.find((v) => v.signal === 'file-edit-from-readonly-kind')
      expect(violation).toBeDefined()
      expect(violation!.detail).toContain('1 file(s)')
    })
  })

  describe('impl-output-from-readonly-kind', () => {
    const diffText = 'here is the fix:\n+ const result = compute();\n- let old = bad();'

    it('flags diff-like output from scout', () => {
      const result = detectDrift({
        agentKind: 'scout',
        assistantText: diffText,
        filesEdited: [],
      })
      expect(result.some((v) => v.signal === 'impl-output-from-readonly-kind')).toBe(true)
    })

    it('flags diff-like output from planner', () => {
      const result = detectDrift({
        agentKind: 'planner',
        assistantText: diffText,
        filesEdited: [],
      })
      expect(result.some((v) => v.signal === 'impl-output-from-readonly-kind')).toBe(true)
    })

    it('flags diff-like output from reviewer', () => {
      const result = detectDrift({
        agentKind: 'reviewer',
        assistantText: diffText,
        filesEdited: [],
      })
      expect(result.some((v) => v.signal === 'impl-output-from-readonly-kind')).toBe(true)
    })

    it('allows diff-like output from implementer', () => {
      const result = detectDrift({
        agentKind: 'implementer',
        assistantText: diffText,
        filesEdited: [],
      })
      expect(result.some((v) => v.signal === 'impl-output-from-readonly-kind')).toBe(false)
    })

    it('allows diff-like output from generic', () => {
      const result = detectDrift({
        agentKind: 'generic',
        assistantText: diffText,
        filesEdited: [],
      })
      expect(result.some((v) => v.signal === 'impl-output-from-readonly-kind')).toBe(false)
    })

    it('does not trigger on plain code discussion', () => {
      const result = detectDrift({
        agentKind: 'scout',
        assistantText: 'the function is defined at line 42:\n```\nconst x = 1;\n```',
        filesEdited: [],
      })
      expect(result.some((v) => v.signal === 'impl-output-from-readonly-kind')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('returns empty array when no violations', () => {
      const result = detectDrift({
        agentKind: 'scout',
        assistantText: 'found the file at src/main.ts',
        filesEdited: [],
      })
      expect(result).toHaveLength(0)
    })

    it('returns multiple violations when multiple rules trigger', () => {
      const result = detectDrift({
        agentKind: 'scout',
        assistantText: '<<plan>>\ntitle\n<</plan>>\n+ const x = compute();',
        filesEdited: ['src/foo.ts'],
      })
      expect(result.length).toBeGreaterThanOrEqual(2)
    })

    const allKinds: AgentKind[] = [
      'scout',
      'planner',
      'implementer',
      'debugger',
      'tester',
      'reviewer',
      'docs',
      'generic',
    ]

    it('generic never triggers any violation', () => {
      const result = detectDrift({
        agentKind: 'generic',
        assistantText: '<<plan>>\ntitle\n<</plan>>\n+ const x = 1;',
        filesEdited: ['src/foo.ts', 'README.md'],
      })
      expect(result).toHaveLength(0)
    })

    it.each(allKinds)('%s kind does not crash with empty input', (kind) => {
      const result = detectDrift({ agentKind: kind, assistantText: '', filesEdited: [] })
      expect(Array.isArray(result)).toBe(true)
    })
  })
})
