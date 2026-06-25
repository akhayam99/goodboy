const ACTION_VERBS = new Set([
  'fix',
  'add',
  'refactor',
  'debug',
  'update',
  'implement',
  'create',
  'remove',
  'delete',
  'rename',
  'test',
  'write',
  'move',
  'build',
  'migrate',
  'deploy',
  'review',
  'setup',
  'check',
  'parse',
  'convert',
  'extract',
  'generate',
  'optimize',
  'improve',
  'change',
  'replace',
  'integrate',
  'configure',
  'wire',
  'hook',
  'expose',
  'patch',
  'bump',
  'clean',
  'lint',
  'format',
])

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'and',
  'or',
  'is',
  'are',
  'was',
  'be',
  'with',
  'from',
  'by',
  'as',
  'i',
  'me',
  'my',
  'you',
  'your',
  'it',
  'its',
  'this',
  'that',
  'can',
  'could',
  'would',
  'should',
  'please',
  'make',
  'do',
  'let',
  'want',
  'need',
  'help',
])

export const heuristicAgentTitle = (prompt: string): string | null => {
  const clean = prompt
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[*_#>\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const first = clean.slice(0, 300).split('\n')[0] ?? ''
  const words = first.toLowerCase().split(/\s+/).filter(Boolean)

  const verbIdx = words.findIndex((w) => ACTION_VERBS.has(w))
  if (verbIdx !== -1) {
    const slice = words.slice(verbIdx, verbIdx + 6)
    const significant = slice.filter((w, i) => i === 0 || !STOP_WORDS.has(w)).slice(0, 3)
    if (significant.length >= 2) {
      return significant.join(' ')
    }
  }

  const significant = words.filter((w) => !STOP_WORDS.has(w)).slice(0, 3)
  return significant.length >= 2 ? significant.join(' ') : null
}
