export type ResolverFollowUpIntent = 'fix' | 'redo' | 'rework' | 'custom';

type Params = {
  readonly threadId: string;
  readonly intent: ResolverFollowUpIntent;
  readonly notes: string;
  readonly priorCommitSha?: string;
};

const reportOne = ({ threadId }: { readonly threadId: string }): ReadonlyArray<string> => [
  `Finish with exactly one fresh <<comment-resolved threadId="${threadId}" commitSha="the sha you committed">> marker,`,
  `followed by <<comment-reply id="${threadId}">>the reply to post on it<</comment-reply>>.`,
  'Leave every other thread you own untouched.',
];

const amendInstruction = ({ priorCommitSha }: Pick<Params, 'priorCommitSha'>): string | null => {
  if (priorCommitSha === undefined) {
    return null;
  }
  return `You already resolved this thread with commit ${priorCommitSha}. If that exact commit is still HEAD and \`git branch -r --contains ${priorCommitSha}\` prints nothing, apply the new changes and run \`git commit --amend --no-edit\` to keep one commit for this thread. If HEAD moved past it or a remote contains it, make a normal new commit instead. Never rebase or force-push.`;
};

const bodyFor = ({
  threadId,
  intent,
  priorCommitSha,
}: Omit<Params, 'notes'>): ReadonlyArray<string> => {
  const amend = amendInstruction({ priorCommitSha });
  if (intent === 'fix') {
    return [
      `Closing review thread ${threadId} without a change is not accepted.`,
      amend ?? 'Implement the change that thread asks for and commit it.',
      ...reportOne({ threadId }),
    ];
  }
  if (intent === 'redo') {
    return [
      `The change you committed for review thread ${threadId} is not the one to keep.`,
      amend ?? 'Redo it and commit again.',
      ...reportOne({ threadId }),
    ];
  }
  if (intent === 'rework') {
    return [
      `The reply you drafted for review thread ${threadId} is not the one to post.`,
      `Write a different one and emit only <<comment-reply id="${threadId}">>the new reply<</comment-reply>>,`,
      'keeping the outcome you already reported for that thread.',
      'Leave every other thread you own untouched.',
    ];
  }
  return [
    `Handle review thread ${threadId} as described below, then report only that thread:`,
    `exactly one outcome marker for ${threadId} and one <<comment-reply id="${threadId}">>the reply to post on it<</comment-reply>> block.`,
    'Leave every other thread you own untouched.',
  ];
};

export const resolverThreadFollowUpPrompt = ({
  threadId,
  intent,
  notes,
  priorCommitSha,
}: Params): string => {
  const trimmed = notes.trim();
  const body = bodyFor({ threadId, intent, priorCommitSha }).join(' ');
  return trimmed === '' ? body : `${body}\n\n${trimmed}`;
};
