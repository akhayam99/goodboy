import type { ExternalTaskRelation } from '@goodboy/types';

export type LinkChoice = {
  readonly relation: ExternalTaskRelation;
};

export const relationFor = ({
  isClosing,
}: {
  readonly isClosing: boolean;
}): ExternalTaskRelation => (isClosing ? 'closes' : 'part-of');

export const LINKED_LABEL = 'Linked to this session';
