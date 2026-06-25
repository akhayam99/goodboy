import { describe, expect, it } from 'vitest'
import type { TranscriptItem } from './transcript-items'
import { clusterOperations } from './cluster-operations'

function tool(id: string, ended = true): TranscriptItem {
  return {
    kind: 'tool_call',
    key: `tool-${id}`,
    toolUseId: id,
    toolName: 'grep',
    input: null,
    output: null,
    isError: false,
    ended,
  }
}

function userText(key: string): TranscriptItem {
  return { kind: 'user_text', key, text: 'hi', at: '2026-06-08T10:00:00.000Z' } as TranscriptItem
}

function assistantText(key: string): TranscriptItem {
  return { kind: 'assistant_text', key, text: 'done' }
}

function edit(key: string): TranscriptItem {
  return { kind: 'file_edit', key, path: '/a/b.ts', editType: 'modify' }
}

function usage(key: string): TranscriptItem {
  return {
    kind: 'usage',
    key,
    usage: {
      inputTokens: 1,
      outputTokens: 1,
      cachedInputTokens: 0,
      estimatedCostUsd: 0,
    },
  }
}

function permission(key: string): TranscriptItem {
  return {
    kind: 'permission_request',
    key,
    toolUseId: key,
    toolName: 'Bash',
    runId: 'run-1',
    input: null,
    at: '2026-06-08T10:00:00.000Z',
  } as TranscriptItem
}

describe('clusterOperations', () => {
  it('groups a consecutive run of clustered kinds into one operations row', () => {
    const rows = clusterOperations([
      userText('u1'),
      tool('a'),
      edit('e1'),
      tool('b'),
      assistantText('t1'),
    ])
    expect(rows.map((r) => r.kind)).toEqual(['item', 'operations', 'item'])
    const ops = rows[1]!
    expect(ops.kind === 'operations' && ops.items).toHaveLength(3)
  })

  it('keeps non-clustered items (text, permissions) as standalone item rows', () => {
    const rows = clusterOperations([
      assistantText('t1'),
      permission('p1'),
      tool('a'),
      userText('u1'),
    ])
    expect(rows.map((r) => r.kind)).toEqual(['item', 'item', 'operations', 'item'])
  })

  it('breaks the cluster when a non-clustered item interrupts the run', () => {
    const rows = clusterOperations([tool('a'), permission('p1'), tool('b')])
    expect(rows.map((r) => r.kind)).toEqual(['operations', 'item', 'operations'])
  })

  it('derives a stable key from the first item in the group', () => {
    const rows = clusterOperations([tool('a'), tool('b')])
    expect(rows[0]!.key).toBe('ops-tool-a')
  })

  it('returns an empty array for no items', () => {
    expect(clusterOperations([])).toEqual([])
  })

  it('renders a lone usage line inline, not as a 1-item operations cluster', () => {
    const rows = clusterOperations([assistantText('t1'), usage('u1'), assistantText('t2')])
    expect(rows.map((r) => r.kind)).toEqual(['item', 'item', 'item'])
  })

  it('absorbs usage into a cluster when it sits next to a real operation', () => {
    const rows = clusterOperations([tool('a'), usage('u1')])
    expect(rows.map((r) => r.kind)).toEqual(['operations'])
    const ops = rows[0]!
    expect(ops.kind === 'operations' && ops.items).toHaveLength(2)
  })
})
