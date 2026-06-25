import { describe, expect, it, vi } from 'vitest'
import type { GhRunner } from '../gh'
import { parseUnifiedDiff } from '../diff'

describe('parseUnifiedDiff', () => {
  it('returns empty array for empty input', () => {
    expect(parseUnifiedDiff('')).toEqual([])
  })

  it('parses a simple modified file with one hunk', () => {
    const diff = [
      'diff --git a/src/foo.ts b/src/foo.ts',
      'index abc..def 100644',
      '--- a/src/foo.ts',
      '+++ b/src/foo.ts',
      '@@ -1,3 +1,4 @@',
      ' const x = 1;',
      '-const y = 2;',
      '+const y = 3;',
      '+const z = 4;',
    ].join('\n')

    const files = parseUnifiedDiff(diff)
    expect(files).toHaveLength(1)
    const file = files[0]
    expect(file?.path).toBe('src/foo.ts')
    expect(file?.status).toBe('modified')
    expect(file?.additions).toBe(2)
    expect(file?.deletions).toBe(1)
    expect(file?.binary).toBe(false)

    const hunk = file?.hunks[0]
    expect(hunk?.header).toBe('@@ -1,3 +1,4 @@')
    expect(hunk?.oldStart).toBe(1)
    expect(hunk?.oldLines).toBe(3)
    expect(hunk?.newStart).toBe(1)
    expect(hunk?.newLines).toBe(4)

    const lines = hunk?.lines
    expect(lines).toHaveLength(4)
    expect(lines?.[0]).toMatchObject({
      kind: 'context',
      oldLine: 1,
      newLine: 1,
      text: 'const x = 1;',
    })
    expect(lines?.[1]).toMatchObject({
      kind: 'del',
      oldLine: 2,
      newLine: null,
      text: 'const y = 2;',
    })
    expect(lines?.[2]).toMatchObject({
      kind: 'add',
      oldLine: null,
      newLine: 2,
      text: 'const y = 3;',
    })
    expect(lines?.[3]).toMatchObject({
      kind: 'add',
      oldLine: null,
      newLine: 3,
      text: 'const z = 4;',
    })
  })

  it('recognises new file mode → status added', () => {
    const diff = [
      'diff --git a/new.ts b/new.ts',
      'new file mode 100644',
      'index 0000000..abc1234',
      '--- /dev/null',
      '+++ b/new.ts',
      '@@ -0,0 +1 @@',
      '+export const x = 1;',
    ].join('\n')

    const files = parseUnifiedDiff(diff)
    expect(files[0]?.status).toBe('added')
  })

  it('recognises deleted file mode → status deleted', () => {
    const diff = [
      'diff --git a/old.ts b/old.ts',
      'deleted file mode 100644',
      'index abc1234..0000000',
      '--- a/old.ts',
      '+++ /dev/null',
      '@@ -1 +0,0 @@',
      '-export const x = 1;',
    ].join('\n')

    const files = parseUnifiedDiff(diff)
    expect(files[0]?.status).toBe('deleted')
  })

  it('recognises rename → status renamed with oldPath', () => {
    const diff = [
      'diff --git a/old-name.ts b/new-name.ts',
      'similarity index 95%',
      'rename from old-name.ts',
      'rename to new-name.ts',
    ].join('\n')

    const files = parseUnifiedDiff(diff)
    expect(files[0]?.status).toBe('renamed')
    expect(files[0]?.oldPath).toBe('old-name.ts')
    expect(files[0]?.path).toBe('new-name.ts')
  })

  it('sets binary:true for binary files', () => {
    const diff = [
      'diff --git a/image.png b/image.png',
      'index abc..def 100644',
      'Binary files a/image.png and b/image.png differ',
    ].join('\n')

    const files = parseUnifiedDiff(diff)
    expect(files[0]?.binary).toBe(true)
  })

  it('handles multiple files in one diff', () => {
    const diff = [
      'diff --git a/a.ts b/a.ts',
      '--- a/a.ts',
      '+++ b/a.ts',
      '@@ -1 +1 @@',
      '-old a',
      '+new a',
      'diff --git a/b.ts b/b.ts',
      '--- a/b.ts',
      '+++ b/b.ts',
      '@@ -1 +1 @@',
      '-old b',
      '+new b',
    ].join('\n')

    const files = parseUnifiedDiff(diff)
    expect(files).toHaveLength(2)
    expect(files[0]?.path).toBe('a.ts')
    expect(files[1]?.path).toBe('b.ts')
  })

  it('tracks oldLine and newLine cursors through context/add/del lines', () => {
    const diff = [
      'diff --git a/x.ts b/x.ts',
      '--- a/x.ts',
      '+++ b/x.ts',
      '@@ -5,4 +5,4 @@',
      ' line5',
      '-line6',
      '+line6-new',
      ' line7',
    ].join('\n')

    const files = parseUnifiedDiff(diff)
    const lines = files[0]?.hunks[0]?.lines
    expect(lines?.[0]).toMatchObject({ kind: 'context', oldLine: 5, newLine: 5 })
    expect(lines?.[1]).toMatchObject({ kind: 'del', oldLine: 6, newLine: null })
    expect(lines?.[2]).toMatchObject({ kind: 'add', oldLine: null, newLine: 6 })
    expect(lines?.[3]).toMatchObject({ kind: 'context', oldLine: 7, newLine: 7 })
  })

  it('path without oldPath when old and new paths match (modified)', () => {
    const diff = [
      'diff --git a/same.ts b/same.ts',
      '--- a/same.ts',
      '+++ b/same.ts',
      '@@ -1 +1 @@',
      '-old',
      '+new',
    ].join('\n')

    const files = parseUnifiedDiff(diff)
    expect(files[0]?.path).toBe('same.ts')
    expect(files[0]?.oldPath).toBeUndefined()
  })
})
