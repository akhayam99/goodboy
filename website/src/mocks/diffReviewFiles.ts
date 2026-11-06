type DiffReviewFile = {
  readonly name: string;
  readonly state: 'active' | 'viewed' | 'none';
  readonly hasNote: boolean;
};

export const DIFF_REVIEW_FILES: readonly DiffReviewFile[] = [
  { name: 'applyWebhook.ts', state: 'active', hasNote: true },
  { name: 'dedupe.ts', state: 'viewed', hasNote: false },
];
