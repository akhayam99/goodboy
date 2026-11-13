import type { Tone } from '@goodboy/ui';

type ReviewVerdict = 'approved' | 'changes_requested' | 'commented';

export type ActivityItem =
  | {
      readonly kind: 'opened';
      readonly key: string;
      readonly at: string;
      readonly who: string | null;
      readonly avatarUrl?: string | null;
      readonly isDraft: boolean;
    }
  | {
      readonly kind: 'push';
      readonly key: string;
      readonly at: string;
      readonly who: string | null;
      readonly avatarUrl?: string | null;
      readonly count: number;
      readonly pushes: number;
      readonly sha: string;
    }
  | {
      readonly kind: 'review';
      readonly key: string;
      readonly at: string;
      readonly who: string;
      readonly avatarUrl?: string | null;
      readonly verdict: ReviewVerdict;
      readonly text: string;
      readonly isBot?: boolean;
    }
  | {
      readonly kind: 'comments';
      readonly key: string;
      readonly at: string;
      readonly needYou: number;
      readonly open: number;
      readonly hasPeople: boolean;
    }
  | {
      readonly kind: 'checks';
      readonly key: string;
      readonly at: string;
      readonly text: string;
      readonly isRunning: boolean;
      readonly isFailing: boolean;
    }
  | {
      readonly kind: 'bot';
      readonly key: string;
      readonly at: string;
      readonly who: string;
      readonly avatarUrl?: string | null;
      readonly word: string;
      readonly tone: Tone;
      readonly count: number;
      readonly notes: ReadonlyArray<string>;
    }
  | { readonly kind: 'edit'; readonly key: string; readonly at: string; readonly what: string }
  | {
      readonly kind: 'merged';
      readonly key: string;
      readonly at: string;
      readonly who: string | null;
      readonly avatarUrl?: string | null;
    }
  | { readonly kind: 'closed'; readonly key: string; readonly at: string };
