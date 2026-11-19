type DiffReviewFile = {
  readonly name: string;
  readonly state: 'active' | 'viewed' | 'none';
  readonly hasNote: boolean;
  readonly added: number;
  readonly removed: number;
};

export const DIFF_REVIEW_FILES: readonly DiffReviewFile[] = [
  { name: 'applyWebhook.ts', state: 'active', hasNote: true, added: 14, removed: 6 },
  { name: 'dedupe.ts', state: 'viewed', hasNote: false, added: 6, removed: 4 },
];
