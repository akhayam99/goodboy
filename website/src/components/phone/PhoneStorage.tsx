type Folder = {
  readonly branch: string;
  readonly note: string;
  readonly size: string;
};

const FOLDERS: readonly Folder[] = [
  { branch: 'hl/flaky-retry-test', note: 'Archived session, 34 days', size: '2.5 GB' },
  { branch: 'hl/retire-export-cron', note: 'Archived session, 38 days', size: '1.8 GB' },
  { branch: 'hl/receipt-email-retry', note: 'Deleted session, 31 days', size: '700 MB' },
];

export const PhoneStorage = () => (
  <div
    className="pCard"
    role="img"
    aria-label="Three working copies of old sessions, 5.0 GB in all, safe to remove in one click, and a token flagged in a saved script"
  >
    <div className="pLabel">Worktrees · 5.0 GB</div>
    <ul className="pRows">
      {FOLDERS.map((folder) => (
        <li key={folder.branch}>
          <span className="pBranch">{folder.branch}</span>
          <span className="pMeta">
            {folder.note}
            <span className="pCost">{folder.size}</span>
          </span>
          <span className="pState ok">Safe to remove</span>
        </li>
      ))}
    </ul>
    <span className="pButton">Remove 3 safe folders · 5.0 GB</span>
    <div className="pFinding">
      <span className="pTask">1 saved script looks like it contains a token</span>
      <span className="pMeta">
        <span className="pMono">Token ending ••••9f2c</span>
        <span className="pAction">Not a secret</span>
      </span>
    </div>
  </div>
);
