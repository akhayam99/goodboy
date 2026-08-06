import type { GhTokenMode } from '@goodboy/types';

type PreviewHintParams = {
  readonly mode: GhTokenMode | null;
};

export const previewHint = ({ mode }: PreviewHintParams): string => {
  if (mode == null) {
    return 'Checking how this will send.';
  }
  switch (mode) {
    case 'gh-cli':
      return 'Sent directly, using your GitHub CLI login.';
    case 'pat':
      return 'Sent directly, using your GitHub token.';
    case 'absent':
      return 'Opens GitHub in your browser with this pre-filled. You submit it there.';
    default: {
      const unreachable: never = mode;
      return unreachable;
    }
  }
};
