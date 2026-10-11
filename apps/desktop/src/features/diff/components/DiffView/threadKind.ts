import { REVIEW_SOURCE_LABEL } from '@goodboy/core';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { DiffThread, DiffThreadHost } from './types';

export const HOST_GLYPH = {
  github: CONCEPT_ICONS.github,
  gitlab: CONCEPT_ICONS.gitlab,
  bitbucket: CONCEPT_ICONS.bitbucket,
} as const satisfies Record<DiffThreadHost, unknown>;

type HostParams = {
  readonly host: DiffThreadHost | null;
};

type ThreadParams = {
  readonly thread: DiffThread;
};

const hostLabelOf = ({ host }: HostParams): string =>
  host === null ? 'the host' : REVIEW_SOURCE_LABEL[host];

export const kindLabelOf = ({ thread }: ThreadParams): string => {
  if (thread.source === 'host') {
    return `On ${hostLabelOf({ host: thread.host })}`;
  }
  return thread.kindLabel ?? 'Note';
};
