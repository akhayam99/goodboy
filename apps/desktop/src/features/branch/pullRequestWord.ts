import type { PullRequestStateKind } from '@goodboy/types';
import { pullRequestKindOf } from '../../shared/utils/pullRequestKind';
import { pullRequestStateWordOf } from './pullRequestStateWordOf';

type Params = {
  readonly state: PullRequestStateKind;
  readonly isDraft: boolean;
};

export const pullRequestWord = ({ state, isDraft }: Params): string =>
  pullRequestStateWordOf({ state: pullRequestKindOf({ state, isDraft }) }) ?? '';
