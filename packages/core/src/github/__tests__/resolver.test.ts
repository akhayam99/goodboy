import { describe, expect, it, vi } from 'vitest'
import type { GhRunner } from '../gh'
import { GhCliError } from '../gh'
import { detectRepoSlug, resolvePrForBranch } from '../resolver'

function makeRunner(result: { stdout: string; stderr: string; exitCode: number }): GhRunner {
  return { run: vi.fn().mockResolvedValue(result) }
}

function makeJsonRunner(data: unknown): GhRunner {
  return makeRunner({ stdout: JSON.stringify(data), stderr: '', exitCode: 0 })
}

const BASE_RAW = {
  number: 1,
  title: 'PR title',
  url: 'https://github.com/org/repo/pull/1',
  isDraft: false,
  mergeable: 'MERGEABLE' as const,
  baseRefName: 'main',
  headRefName: 'feature',
  reviewDecision: null as null,
  statusCheckRollup: null as null,
  updatedAt: '2024-01-01T00:00:00Z',
  body: null as null,
  autoMergeRequest: null as Record<string, unknown> | null,
}

describe('resolvePrForBranch', () => {
  it('returns null when runner returns empty array', async () => {
    const runner = makeJsonRunner([])
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result).toBeNull()
  })

  it('returns null when GhCliError thrown', async () => {
    const runner: GhRunner = {
      run: vi.fn().mockResolvedValue({ stdout: '', stderr: 'not found', exitCode: 1 }),
    }
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result).toBeNull()
  })

  it('re-throws non-GhCliError errors', async () => {
    const runner: GhRunner = {
      run: vi.fn().mockRejectedValue(new TypeError('network error')),
    }
    await expect(resolvePrForBranch(runner, 'org/repo', 'feature')).rejects.toBeInstanceOf(
      TypeError,
    )
  })

  it('returns most recent OPEN PR when multiple exist', async () => {
    const prs = [
      { ...BASE_RAW, number: 1, state: 'OPEN' as const, updatedAt: '2024-01-01T00:00:00Z' },
      { ...BASE_RAW, number: 2, state: 'OPEN' as const, updatedAt: '2024-03-01T00:00:00Z' },
      { ...BASE_RAW, number: 3, state: 'MERGED' as const, updatedAt: '2024-06-01T00:00:00Z' },
    ]
    const runner = makeJsonRunner(prs)
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.number).toBe(2)
  })

  it('falls back to most recent overall when no OPEN PRs', async () => {
    const prs = [
      { ...BASE_RAW, number: 1, state: 'CLOSED' as const, updatedAt: '2024-01-01T00:00:00Z' },
      { ...BASE_RAW, number: 2, state: 'MERGED' as const, updatedAt: '2024-06-01T00:00:00Z' },
    ]
    const runner = makeJsonRunner(prs)
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.number).toBe(2)
  })

  it('maps MERGED state → merged', async () => {
    const pr = { ...BASE_RAW, number: 1, state: 'MERGED' as const }
    const runner = makeJsonRunner([pr])
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.state).toBe('merged')
  })

  it('maps CLOSED state → closed', async () => {
    const pr = { ...BASE_RAW, number: 1, state: 'CLOSED' as const }
    const runner = makeJsonRunner([pr])
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.state).toBe('closed')
  })

  it('maps isDraft:true on OPEN → draft', async () => {
    const pr = { ...BASE_RAW, number: 1, state: 'OPEN' as const, isDraft: true }
    const runner = makeJsonRunner([pr])
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.state).toBe('draft')
  })

  it('maps OPEN + reviewDecision APPROVED → approved (not draft)', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      isDraft: false,
      reviewDecision: 'APPROVED' as const,
    }
    const runner = makeJsonRunner([pr])
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.state).toBe('approved')
  })

  it('does not map APPROVED to approved when draft is true', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      isDraft: true,
      reviewDecision: 'APPROVED' as const,
    }
    const runner = makeJsonRunner([pr])
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.state).toBe('draft')
  })

  it('does not map APPROVED to approved when MERGED', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'MERGED' as const,
      reviewDecision: 'APPROVED' as const,
    }
    const runner = makeJsonRunner([pr])
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.state).toBe('merged')
  })

  it('maps OPEN + autoMergeRequest object → queued (with mergeQueue)', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      autoMergeRequest: { enabledAt: '2024-01-01T00:00:00Z' },
    }
    const runner = makeJsonRunner([pr])
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.state).toBe('queued')
    expect(result?.mergeQueue).toEqual({ position: null })
  })

  it('queued beats approved when autoMergeRequest present', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      reviewDecision: 'APPROVED' as const,
      autoMergeRequest: {},
    }
    const runner = makeJsonRunner([pr])
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.state).toBe('queued')
  })

  it('OPEN + autoMergeRequest null → unchanged (mergeQueue null)', async () => {
    const pr = { ...BASE_RAW, number: 1, state: 'OPEN' as const }
    const runner = makeJsonRunner([pr])
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.state).toBe('open')
    expect(result?.mergeQueue).toBeNull()
  })

  it('draft + autoMergeRequest → still draft', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      isDraft: true,
      autoMergeRequest: {},
    }
    const runner = makeJsonRunner([pr])
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.state).toBe('draft')
  })

  it('MERGED + autoMergeRequest → merged (terminal wins)', async () => {
    const pr = { ...BASE_RAW, number: 1, state: 'MERGED' as const, autoMergeRequest: {} }
    const runner = makeJsonRunner([pr])
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.state).toBe('merged')
  })

  it('CLOSED + autoMergeRequest → closed (terminal wins)', async () => {
    const pr = { ...BASE_RAW, number: 1, state: 'CLOSED' as const, autoMergeRequest: {} }
    const runner = makeJsonRunner([pr])
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.state).toBe('closed')
  })

  it('CONFLICTING → mergeable: false', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      mergeable: 'CONFLICTING' as const,
    }
    const runner = makeJsonRunner([pr])
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.mergeable).toBe(false)
  })

  it('MERGEABLE → mergeable: true', async () => {
    const pr = { ...BASE_RAW, number: 1, state: 'OPEN' as const, mergeable: 'MERGEABLE' as const }
    const runner = makeJsonRunner([pr])
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.mergeable).toBe(true)
  })

  it('UNKNOWN → mergeable: null', async () => {
    const pr = { ...BASE_RAW, number: 1, state: 'OPEN' as const, mergeable: 'UNKNOWN' as const }
    const runner = makeJsonRunner([pr])
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.mergeable).toBeNull()
  })

  it('checks: any FAILURE → failure', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      statusCheckRollup: [{ conclusion: 'SUCCESS' as const }, { conclusion: 'FAILURE' as const }],
    }
    const runner = makeJsonRunner([pr])
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.checks).toBe('failure')
  })

  it('checks: all SUCCESS → success', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      statusCheckRollup: [{ conclusion: 'SUCCESS' as const }, { conclusion: 'SUCCESS' as const }],
    }
    const runner = makeJsonRunner([pr])
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.checks).toBe('success')
  })

  it('checks: mixed SUCCESS + PENDING → pending', async () => {
    const pr = {
      ...BASE_RAW,
      number: 1,
      state: 'OPEN' as const,
      statusCheckRollup: [{ conclusion: 'SUCCESS' as const }, { state: 'PENDING' as const }],
    }
    const runner = makeJsonRunner([pr])
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.checks).toBe('pending')
  })

  it('checks: empty statusCheckRollup → null', async () => {
    const pr = { ...BASE_RAW, number: 1, state: 'OPEN' as const, statusCheckRollup: [] }
    const runner = makeJsonRunner([pr])
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.checks).toBeNull()
  })

  it('checks: null statusCheckRollup → null', async () => {
    const pr = { ...BASE_RAW, number: 1, state: 'OPEN' as const, statusCheckRollup: null }
    const runner = makeJsonRunner([pr])
    const result = await resolvePrForBranch(runner, 'org/repo', 'feature')
    expect(result?.checks).toBeNull()
  })
})

describe('detectRepoSlug', () => {
  it('returns slug on success', async () => {
    const runner = makeRunner({ stdout: 'org/repo\n', stderr: '', exitCode: 0 })
    const result = await detectRepoSlug(runner, '/some/path')
    expect(result).toBe('org/repo')
  })

  it('returns null on non-zero exit', async () => {
    const runner = makeRunner({ stdout: '', stderr: 'not a repo', exitCode: 128 })
    const result = await detectRepoSlug(runner, '/some/path')
    expect(result).toBeNull()
  })

  it('returns null when runner throws', async () => {
    const runner: GhRunner = {
      run: vi.fn().mockRejectedValue(new Error('spawn failed')),
    }
    const result = await detectRepoSlug(runner, '/some/path')
    expect(result).toBeNull()
  })

  it('returns null when stdout is empty', async () => {
    const runner = makeRunner({ stdout: '   ', stderr: '', exitCode: 0 })
    const result = await detectRepoSlug(runner, '/some/path')
    expect(result).toBeNull()
  })
})
