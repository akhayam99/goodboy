type Thread = {
  readonly file: string;
  readonly comment: string;
  readonly state: string;
  readonly tone: string;
  readonly action: string;
};

const THREADS: readonly Thread[] = [
  {
    file: 'src/webhooks/logging.ts',
    comment: 'This debug log dumps the full payload, including the customer’s email address.',
    state: 'Fixed in 4f21c8b',
    tone: 'ok',
    action: '',
  },
  {
    file: 'src/webhooks/metrics.ts',
    comment: 'Same loop should emit a metric when it gives up.',
    state: 'Reply ready',
    tone: 'warn',
    action: 'Review',
  },
  {
    file: 'src/webhooks/errorShape.ts',
    comment: 'What should the client see once we give up retrying?',
    state: 'Needs you',
    tone: 'warn',
    action: 'Answer',
  },
];

export const PhoneResolve = () => (
  <div
    className="pCard"
    role="img"
    aria-label="Review comments on pull request 318: one fixed in commit 4f21c8b, one reply ready to review, one question for you"
  >
    <div className="pHead">
      <span className="pTitle">Conversations on #318</span>
      <span className="pChips">
        <span className="pChip">7 open on GitHub</span>
        <span className="pChip pPrimary">Resolve 7 new</span>
      </span>
    </div>
    <ul className="pRows">
      {THREADS.map((thread) => (
        <li key={thread.file}>
          <span className="pFile">{thread.file}</span>
          <span className="pTask">{thread.comment}</span>
          <span className="pMeta">
            <span className={`pState ${thread.tone}`}>{thread.state}</span>
            {thread.action === '' ? null : <span className="pAction">{thread.action}</span>}
          </span>
        </li>
      ))}
    </ul>
  </div>
);
