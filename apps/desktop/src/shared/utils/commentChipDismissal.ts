type Params = {
  readonly threadId: string;
};

const DISMISS_PREFIX = 'goodboy:comment-dismissed:';

export const commentChipDismissal = {
  read: ({ threadId }: Params): boolean => {
    try {
      return localStorage.getItem(DISMISS_PREFIX + threadId) === '1';
    } catch {
      return false;
    }
  },
  persist: ({ threadId }: Params): void => {
    try {
      localStorage.setItem(DISMISS_PREFIX + threadId, '1');
    } catch {
      return;
    }
  },
};
