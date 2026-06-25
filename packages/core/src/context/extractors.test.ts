import { describe, expect, it } from 'vitest'
import type { TurnEvent } from '@goodboy/types'
import {
  assessPlanReadiness,
  extractClusterDone,
  extractClustersFromMarker,
  extractCommentResolved,
  extractCommentWontfix,
  extractFilesTouched,
  extractHandoff,
  extractMarkers,
  extractPlanFromMarker,
  extractScoutSplit,
  extractStepDone,
  isOpenQuestionAnswerText,
  isReviewThreadId,
  mergeIntoSlot,
  stripControlMarkers,
  wrapOpenQuestionAnswers,
} from './extractors'

function fileEdit(path: string): TurnEvent {
  return {
    kind: 'file_edit',
    runId: 'r1' as TurnEvent extends { runId: infer R } ? R : never,
    path,
    editType: 'modify',
    at: '2026-05-09T00:00:00Z' as TurnEvent extends { at: infer A } ? A : never,
  } as TurnEvent
}

function noise(): TurnEvent {
  return {
    kind: 'assistant_text',
    runId: 'r1',
    delta: 'noise',
    at: '2026-05-09T00:00:00Z',
  } as unknown as TurnEvent
}

describe('extractFilesTouched', () => {
  it('returns empty for no events', () => {
    expect(extractFilesTouched([])).toEqual([])
  })

  it('collects unique paths', () => {
    const events = [fileEdit('a.ts'), fileEdit('b.ts'), fileEdit('a.ts')]
    expect(extractFilesTouched(events)).toEqual(['a.ts', 'b.ts'])
  })

  it('ignores non-file_edit events', () => {
    const events = [noise(), fileEdit('a.ts'), noise()]
    expect(extractFilesTouched(events)).toEqual(['a.ts'])
  })

  it('preserves first-seen order', () => {
    const events = [fileEdit('z'), fileEdit('a'), fileEdit('m')]
    expect(extractFilesTouched(events)).toEqual(['z', 'a', 'm'])
  })
})

describe('extractMarkers', () => {
  it('returns empty arrays when text has no markers', () => {
    const out = extractMarkers('hello world, no markers here')
    expect(out.decisions).toEqual([])
    expect(out.questions).toEqual([])
  })

  it('extracts a single decision marker', () => {
    const text =
      'analysis complete. <<ctx-decision>>switch to OAuth2 PKCE<</ctx-decision>> proceeding.'
    expect(extractMarkers(text).decisions).toEqual(['switch to OAuth2 PKCE'])
  })

  it('extracts multiple markers of each type', () => {
    const text = `
      <<ctx-decision>>use sqlite for local persistence<</ctx-decision>>
      <<ctx-question>>do we need wal mode?<</ctx-question>>
      <<ctx-decision>>tauri 2 over electron<</ctx-decision>>
    `
    const out = extractMarkers(text)
    expect(out.decisions).toEqual(['use sqlite for local persistence', 'tauri 2 over electron'])
    expect(out.questions).toEqual([
      { text: 'do we need wal mode?', suggestedAnswers: [], recommendedAnswer: null },
    ])
  })

  it('extracts question with suggestions', () => {
    const text =
      '<<ctx-question suggestions="yes | no | maybe">>do we need wal mode?<</ctx-question>>'
    const out = extractMarkers(text)
    expect(out.questions).toEqual([
      {
        text: 'do we need wal mode?',
        suggestedAnswers: ['yes', 'no', 'maybe'],
        recommendedAnswer: null,
      },
    ])
  })

  it('extracts question without suggestions as empty array', () => {
    const text = '<<ctx-question>>plain question<</ctx-question>>'
    expect(extractMarkers(text).questions).toEqual([
      { text: 'plain question', suggestedAnswers: [], recommendedAnswer: null },
    ])
  })

  it('extracts recommended answer attribute (any order)', () => {
    const text =
      '<<ctx-question recommended="yes" suggestions="yes | no">>do we need wal mode?<</ctx-question>>'
    expect(extractMarkers(text).questions).toEqual([
      { text: 'do we need wal mode?', suggestedAnswers: ['yes', 'no'], recommendedAnswer: 'yes' },
    ])
  })

  it('trims whitespace inside markers', () => {
    const text = '<<ctx-decision>>   indented decision   <</ctx-decision>>'
    expect(extractMarkers(text).decisions).toEqual(['indented decision'])
  })

  it('handles multi-line content inside markers', () => {
    const text = `<<ctx-decision>>line one
line two
line three<</ctx-decision>>`
    expect(extractMarkers(text).decisions[0]).toContain('line one')
    expect(extractMarkers(text).decisions[0]).toContain('line three')
  })

  it('drops empty markers', () => {
    const text = '<<ctx-decision>>   <</ctx-decision>><<ctx-decision>>real one<</ctx-decision>>'
    expect(extractMarkers(text).decisions).toEqual(['real one'])
  })

  it('regex state survives repeat calls (no leaked lastIndex)', () => {
    const text = '<<ctx-decision>>x<</ctx-decision>>'
    expect(extractMarkers(text).decisions).toEqual(['x'])
    expect(extractMarkers(text).decisions).toEqual(['x'])
    expect(extractMarkers(text).decisions).toEqual(['x'])
  })
})

describe('extractPlanFromMarker', () => {
  it('returns null when no plan marker present', () => {
    expect(extractPlanFromMarker('no plan here')).toBeNull()
  })

  it('extracts title from first non-empty line and body as markdown rest', () => {
    const text = `prose before. <<plan>>migrate auth to oauth2
- step 1: scaffolding
- step 2: token exchange<</plan>>`
    expect(extractPlanFromMarker(text)).toEqual({
      title: 'migrate auth to oauth2',
      bodyMd: '- step 1: scaffolding\n- step 2: token exchange',
    })
  })

  it('strips leading # from title', () => {
    const text = `<<plan>>### refactor everything

body line.<</plan>>`
    const out = extractPlanFromMarker(text)
    expect(out?.title).toBe('refactor everything')
    expect(out?.bodyMd).toBe('body line.')
  })

  it('falls back to title-as-body when body empty', () => {
    const text = '<<plan>>only title<</plan>>'
    expect(extractPlanFromMarker(text)).toEqual({
      title: 'only title',
      bodyMd: 'only title',
    })
  })

  it('returns null when marker content is whitespace only', () => {
    const text = '<<plan>>   \n  <</plan>>'
    expect(extractPlanFromMarker(text)).toBeNull()
  })

  it('picks the LAST plan when multiple emitted in a turn', () => {
    const text = `<<plan>>first
body 1<</plan>>
intermediate prose
<<plan>>final
body 2<</plan>>`
    expect(extractPlanFromMarker(text)?.title).toBe('final')
  })

  it('survives repeat calls (no leaked lastIndex)', () => {
    const text = '<<plan>>x\nb<</plan>>'
    expect(extractPlanFromMarker(text)?.title).toBe('x')
    expect(extractPlanFromMarker(text)?.title).toBe('x')
    expect(extractPlanFromMarker(text)?.title).toBe('x')
  })
})

describe('mergeIntoSlot', () => {
  it('returns existing verbatim when no additions', () => {
    expect(mergeIntoSlot('hello', [])).toBe('hello')
  })

  it('appends new lines to empty slot', () => {
    expect(mergeIntoSlot('', ['a', 'b'])).toBe('a\nb')
  })

  it('dedups against existing lines', () => {
    expect(mergeIntoSlot('a\nb', ['b', 'c'])).toBe('a\nb\nc')
  })

  it('returns original string when all additions are duplicates (no change)', () => {
    const original = 'a\nb'
    const result = mergeIntoSlot(original, ['a', 'b'])
    expect(result).toBe(original)
  })

  it('ignores blank additions', () => {
    expect(mergeIntoSlot('x', ['', '   ', 'y'])).toBe('x\ny')
  })

  it('treats whitespace-only as duplicate when stripped', () => {
    expect(mergeIntoSlot('foo', ['  foo  '])).toBe('foo')
  })
})

describe('extractHandoff', () => {
  it('returns null when no marker is present', () => {
    expect(extractHandoff('just chat text')).toBeNull()
  })

  it('parses self-closing marker with quoted reason', () => {
    const text = 'plan emitted. <<handoff kind=implementer reason="plan ready" plan=abc>>'
    expect(extractHandoff(text)).toEqual({
      kind: 'implementer',
      reason: 'plan ready',
      planId: 'abc',
    })
  })

  it('parses without a plan attribute', () => {
    const text = '<<handoff kind=debugger reason="error reproduced">>'
    expect(extractHandoff(text)).toEqual({
      kind: 'debugger',
      reason: 'error reproduced',
      planId: null,
    })
  })

  it('rejects unknown kinds', () => {
    const text = '<<handoff kind=hacker reason=yo>>'
    expect(extractHandoff(text)).toBeNull()
  })

  it('returns the last marker when multiple appear', () => {
    const text =
      '<<handoff kind=scout reason="early">> ... <<handoff kind=implementer reason="final">>'
    expect(extractHandoff(text)?.kind).toBe('implementer')
  })
})

describe('extractCommentResolved', () => {
  it('returns null when no marker is present', () => {
    expect(extractCommentResolved('all done, committed locally')).toBeNull()
  })

  it('parses threadId and commit attributes', () => {
    const text = 'fix applied. <<comment-resolved threadId="PRT_42" commit=a1b2c3d>>'
    expect(extractCommentResolved(text)).toEqual({
      threadId: 'PRT_42',
      commitSha: 'a1b2c3d',
    })
  })

  it('accepts sha as an alias for commit', () => {
    const text = '<<comment-resolved threadId="PRT_1" sha="abc123">>'
    expect(extractCommentResolved(text)).toEqual({
      threadId: 'PRT_1',
      commitSha: 'abc123',
    })
  })

  it('rejects markers missing one of the required attributes', () => {
    expect(extractCommentResolved('<<comment-resolved threadId="PRT_1">>')).toBeNull()
    expect(extractCommentResolved('<<comment-resolved commit="abc">>')).toBeNull()
  })

  it('returns the last well-formed marker when multiple appear', () => {
    const text =
      '<<comment-resolved threadId="PRT_1" commit="aaa">> ... <<comment-resolved threadId="PRT_2" commit="bbb">>'
    expect(extractCommentResolved(text)).toEqual({
      threadId: 'PRT_2',
      commitSha: 'bbb',
    })
  })
})

describe('extractCommentWontfix', () => {
  it('returns null when the marker is absent', () => {
    expect(extractCommentWontfix('this is a valid point, fixing it')).toBeNull()
  })

  it('parses threadId and reason', () => {
    const text =
      'this suggestion misreads the code path. <<comment-wontfix threadId="PRRT_9" reason="guard already covers this case upstream">>'
    expect(extractCommentWontfix(text)).toEqual({
      threadId: 'PRRT_9',
      reason: 'guard already covers this case upstream',
    })
  })

  it('requires both threadId and a non-empty reason', () => {
    expect(extractCommentWontfix('<<comment-wontfix threadId="PRRT_1">>')).toBeNull()
    expect(extractCommentWontfix('<<comment-wontfix reason="nope">>')).toBeNull()
  })
})

describe('isReviewThreadId', () => {
  it('accepts github review thread node ids', () => {
    expect(isReviewThreadId('PRRT_kwDOABC123')).toBe(true)
    expect(isReviewThreadId('PRRT_1')).toBe(true)
  })

  it('rejects local diff comment uuids and neighbouring node-id prefixes', () => {
    expect(isReviewThreadId('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(false)
    expect(isReviewThreadId('th-1')).toBe(false)
    expect(isReviewThreadId('')).toBe(false)
    expect(isReviewThreadId('PR_kwDOABC123')).toBe(false)
    expect(isReviewThreadId('PRR_kwDOABC123')).toBe(false)
    expect(isReviewThreadId('PRRC_kwDOABC123')).toBe(false)
  })
})

describe('assessPlanReadiness', () => {
  const body = '1. step one\n2. step two'

  it('marks ready when body has multiple steps and no open questions', () => {
    expect(
      assessPlanReadiness({ planBody: body, assistantText: `<<plan>>${body}<</plan>>` }),
    ).toEqual({ ready: true, reason: null })
  })

  it('rejects when body has TODO', () => {
    const b = '1. step one\n2. TODO refine'
    expect(assessPlanReadiness({ planBody: b, assistantText: '' }).reason).toBe(
      'incomplete-markers',
    )
  })

  it('rejects when body has only one step', () => {
    expect(assessPlanReadiness({ planBody: '1. only step', assistantText: '' }).reason).toBe(
      'too-few-steps',
    )
  })

  it('rejects when assistant text outside plan asks an open question', () => {
    const text = `<<plan>>${body}<</plan>>\n\nvuoi che continui?`
    expect(assessPlanReadiness({ planBody: body, assistantText: text }).reason).toBe(
      'has-open-question',
    )
  })

  it('does not count open-question phrases that appear inside the plan body', () => {
    const text = `<<plan>>${body}\n\nshould i clarify before step 2?<</plan>>`
    expect(assessPlanReadiness({ planBody: body, assistantText: text }).ready).toBe(true)
  })
})

describe('extractClustersFromMarker', () => {
  it('returns null when no marker present', () => {
    expect(extractClustersFromMarker('just prose, no clusters')).toBeNull()
  })

  it('parses a JSON array of clusters', () => {
    const text = `<<clusters>>[
      {"title":"move files","instructions":"relocate domain files"},
      {"title":"update imports","instructions":"fix import paths"}
    ]<</clusters>>`
    expect(extractClustersFromMarker(text)).toEqual([
      { title: 'move files', instructions: 'relocate domain files' },
      { title: 'update imports', instructions: 'fix import paths' },
    ])
  })

  it('tolerates a json code fence', () => {
    const text = '<<clusters>>```json\n[{"title":"a","instructions":"b"}]\n```<</clusters>>'
    expect(extractClustersFromMarker(text)).toEqual([{ title: 'a', instructions: 'b' }])
  })

  it('drops entries missing title or instructions', () => {
    const text =
      '<<clusters>>[{"title":"keep","instructions":"x"},{"title":"","instructions":"y"},{"title":"z"}]<</clusters>>'
    expect(extractClustersFromMarker(text)).toEqual([{ title: 'keep', instructions: 'x' }])
  })

  it('returns null on malformed json', () => {
    expect(extractClustersFromMarker('<<clusters>>not json<</clusters>>')).toBeNull()
  })

  it('takes the last block when several appear', () => {
    const text =
      '<<clusters>>[{"title":"old","instructions":"x"}]<</clusters>> later <<clusters>>[{"title":"new","instructions":"y"}]<</clusters>>'
    expect(extractClustersFromMarker(text)).toEqual([{ title: 'new', instructions: 'y' }])
  })
})

describe('extractClusterDone', () => {
  it('returns null when no marker present', () => {
    expect(extractClusterDone('done with the work')).toBeNull()
  })

  it('parses the cluster id', () => {
    expect(extractClusterDone('all set <<cluster-done id="c2">>')).toEqual({ id: 'c2' })
  })

  it('takes the last marker when several appear', () => {
    expect(extractClusterDone('<<cluster-done id="c1">> then <<cluster-done id="c2">>')).toEqual({
      id: 'c2',
    })
  })

  it('ignores a marker missing an id', () => {
    expect(extractClusterDone('<<cluster-done reason="x">>')).toBeNull()
  })
})

describe('extractScoutSplit', () => {
  it('returns null when no marker present', () => {
    expect(extractScoutSplit('just prose, no split')).toBeNull()
  })

  it('parses a JSON array of areas', () => {
    const text = `<<scout-split>>[
      {"area":"auth domain","query":"how login and session work"},
      {"area":"billing domain","query":"how invoicing is wired"}
    ]<</scout-split>>`
    expect(extractScoutSplit(text)).toEqual([
      { area: 'auth domain', query: 'how login and session work' },
      { area: 'billing domain', query: 'how invoicing is wired' },
    ])
  })

  it('tolerates a json code fence', () => {
    const text = '<<scout-split>>```json\n[{"area":"a","query":"b"}]\n```<</scout-split>>'
    expect(extractScoutSplit(text)).toEqual([{ area: 'a', query: 'b' }])
  })

  it('drops entries missing area or query', () => {
    const text =
      '<<scout-split>>[{"area":"keep","query":"x"},{"area":"","query":"y"},{"area":"z"}]<</scout-split>>'
    expect(extractScoutSplit(text)).toEqual([{ area: 'keep', query: 'x' }])
  })

  it('returns null on malformed json', () => {
    expect(extractScoutSplit('<<scout-split>>not json<</scout-split>>')).toBeNull()
  })

  it('takes the last block when several appear', () => {
    const text =
      '<<scout-split>>[{"area":"old","query":"x"}]<</scout-split>> later <<scout-split>>[{"area":"new","query":"y"}]<</scout-split>>'
    expect(extractScoutSplit(text)).toEqual([{ area: 'new', query: 'y' }])
  })
})

describe('stripControlMarkers', () => {
  it('strips block markers (plan, clusters, scout-split, ctx-*)', () => {
    const text = 'before <<plan>>some plan<</plan>> middle <<clusters>>json<</clusters>> after'
    expect(stripControlMarkers(text)).toBe('before  middle  after')
  })

  it('strips self-closing markers (handoff, comment-resolved, comment-wontfix, cluster-done)', () => {
    const text =
      'hello <<handoff kind=scout reason="r">> world <<comment-resolved threadid=T1 commit=abc>> end <<comment-wontfix threadid=T2 reason="x">> <<cluster-done id=c1>>'
    expect(stripControlMarkers(text)).toBe('hello  world  end')
  })

  it('strips ctx-question with attributes', () => {
    const text = 'ask <<ctx-question suggestions="a|b">>body<</ctx-question>> done'
    expect(stripControlMarkers(text)).toBe('ask  done')
  })

  it('collapses excessive newlines to double', () => {
    const text = 'a\n\n\n\n\nb'
    expect(stripControlMarkers(text)).toBe('a\n\nb')
  })

  it('leaves ordinary text untouched', () => {
    const text = 'just some text with <<angle brackets>>'
    expect(stripControlMarkers(text)).toBe('just some text with <<angle brackets>>')
  })

  it('is idempotent', () => {
    const text = 'a <<plan>>x<</plan>> b'
    const once = stripControlMarkers(text)
    expect(stripControlMarkers(once)).toBe(once)
  })

  it('resets regex state across calls (no leaked lastIndex)', () => {
    stripControlMarkers('<<plan>>a<</plan>>')
    expect(stripControlMarkers('<<plan>>b<</plan>>')).toBe('')
  })

  it('returns empty string for empty input', () => {
    expect(stripControlMarkers('')).toBe('')
  })

  it('returns empty string when input is only markers', () => {
    expect(stripControlMarkers('<<plan>>x<</plan>><<handoff kind=scout reason="r">>')).toBe('')
  })

  it('handles mixed block and self-closing markers in one string', () => {
    const text =
      'start <<plan>>p<</plan>> mid <<handoff kind=scout reason="r">> <<clusters>>[{"title":"a","instructions":"b"}]<</clusters>> end'
    expect(stripControlMarkers(text)).toBe('start  mid   end')
  })

  it('strips ctx-decision and ctx-resolved block markers', () => {
    const text =
      'before <<ctx-decision>>d<</ctx-decision>> <<ctx-resolved>>r<</ctx-resolved>> after'
    expect(stripControlMarkers(text)).toBe('before   after')
  })

  it('preserves text between multiple markers', () => {
    const text = '<<plan>>a<</plan>> keep this <<plan>>b<</plan>>'
    expect(stripControlMarkers(text)).toBe('keep this')
  })

  it('handles multiline marker content', () => {
    const text = `hello
<<plan>>line 1
line 2
line 3<</plan>>
world`
    expect(stripControlMarkers(text)).toBe('hello\n\nworld')
  })

  it('strips goal and workflow block markers', () => {
    const text = 'before <<goal>>ship it<</goal>> mid <<workflow>>[{"step":1}]<</workflow>> after'
    expect(stripControlMarkers(text)).toBe('before  mid  after')
  })

  it('strips an unclosed block still streaming (no close tag yet)', () => {
    const text = 'Scouting the codebase.\n<<scout-split>>[{"area":"a","query":"b"}]\n<'
    expect(stripControlMarkers(text)).toBe('Scouting the codebase.')
  })

  it('strips a trailing partial self marker still streaming', () => {
    const text = 'all set.\n<<cluster-done id="b6e49426-20e6'
    expect(stripControlMarkers(text)).toBe('all set.')
  })

  it('strips a bare trailing marker fragment', () => {
    expect(stripControlMarkers('done.\n<<')).toBe('done.')
    expect(stripControlMarkers('done.\n<<clus')).toBe('done.')
  })

  it('strips a lone trailing angle bracket from a streaming marker', () => {
    expect(stripControlMarkers('che serve?<')).toBe('che serve?')
    expect(stripControlMarkers('che serve?</')).toBe('che serve?')
    expect(stripControlMarkers('che serve?</ctx')).toBe('che serve?')
  })
})

describe('open-question answer markers', () => {
  it('wraps a body between oq-answers markers', () => {
    const wrapped = wrapOpenQuestionAnswers('Q1: yes\nQ2: no')
    expect(wrapped).toBe('<<oq-answers>>\nQ1: yes\nQ2: no\n<</oq-answers>>')
  })

  it('detects wrapped answer text including leading whitespace', () => {
    expect(isOpenQuestionAnswerText(wrapOpenQuestionAnswers('a'))).toBe(true)
    expect(isOpenQuestionAnswerText('  \n<<oq-answers>>\nx\n<</oq-answers>>')).toBe(true)
  })

  it('returns false for ordinary text', () => {
    expect(isOpenQuestionAnswerText('just a normal answer')).toBe(false)
    expect(isOpenQuestionAnswerText('mentions <<oq-answers>> mid sentence')).toBe(false)
  })
})

describe('extractStepDone', () => {
  it('returns null for text without marker', () => {
    expect(extractStepDone('no markers here')).toBeNull()
  })

  it('extracts id from a valid step-done marker', () => {
    expect(extractStepDone('work done\n<<step-done id="agent-42">>')).toEqual({ id: 'agent-42' })
  })

  it('returns last match when multiple markers present', () => {
    const text = '<<step-done id="first">> middle <<step-done id="second">>'
    expect(extractStepDone(text)).toEqual({ id: 'second' })
  })

  it('ignores marker without id attribute', () => {
    expect(extractStepDone('<<step-done foo="bar">>')).toBeNull()
  })

  it('ignores marker with empty id', () => {
    expect(extractStepDone('<<step-done id="">> text')).toBeNull()
  })

  it('resets regex state across calls', () => {
    extractStepDone('<<step-done id="a">>')
    expect(extractStepDone('<<step-done id="b">>')).toEqual({ id: 'b' })
  })

  it('is stripped by stripControlMarkers (SELF_MARKER_ALT coverage)', () => {
    const text = 'result\n<<step-done id="x">>\ndone'
    expect(stripControlMarkers(text)).toBe('result\n\ndone')
  })
})
