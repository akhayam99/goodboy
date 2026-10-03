import type { ExternalTaskRelation } from '@goodboy/types';

export type LinkScope = 'session' | 'branch' | 'workspace';

export type LinkChoice = {
  readonly scope: LinkScope;
  readonly relation: ExternalTaskRelation;
};

export const relationFor = ({
  scope,
  isClosing,
}: {
  readonly scope: LinkScope;
  readonly isClosing: boolean;
}): ExternalTaskRelation => (scope !== 'workspace' && isClosing ? 'closes' : 'part-of');
