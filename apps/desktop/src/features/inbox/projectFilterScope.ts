import { integrationLabel } from '../integrations/components/IntegrationGlyph';
import { INBOX_KIND_PROVIDERS, isProjectMappedProvider, type InboxFilters } from './kindFilter';
import type { InboxProvider } from './types';

export type ProjectFilterScope = {
  readonly mapped: ReadonlyArray<InboxProvider>;
  readonly unmapped: ReadonlyArray<InboxProvider>;
};

type ScopeParams = {
  readonly connected: ReadonlyArray<InboxProvider>;
  readonly filters: InboxFilters;
};

type NoteParams = {
  readonly scope: ProjectFilterScope;
};

type ListParams = {
  readonly providers: ReadonlyArray<InboxProvider>;
};

const ITEM_NOUN: Readonly<Record<InboxProvider, string>> = {
  github: 'items',
  gitlab: 'items',
  linear: 'issues',
  jira: 'issues',
  sentry: 'errors',
  slack: 'threads',
  bitbucket: 'pull requests',
};

type InViewParams = {
  readonly provider: InboxProvider;
  readonly filters: InboxFilters;
};

const isInView = ({ provider, filters }: InViewParams): boolean =>
  (filters.source == null || filters.source === provider) &&
  (filters.kind === 'all' || INBOX_KIND_PROVIDERS[filters.kind].includes(provider));

export const projectFilterScope = ({ connected, filters }: ScopeParams): ProjectFilterScope => {
  const inView = connected.filter((provider) => isInView({ provider, filters }));
  return {
    mapped: inView.filter((provider) => isProjectMappedProvider({ provider })),
    unmapped: inView.filter((provider) => !isProjectMappedProvider({ provider })),
  };
};

const labelList = ({ providers }: ListParams): string => {
  const labels = providers.map((provider) => integrationLabel({ provider }));
  const last = labels.at(-1) ?? '';
  return labels.length < 2 ? last : `${labels.slice(0, -1).join(', ')} and ${last}`;
};

export const projectFilterNote = ({ scope }: NoteParams): string | null => {
  if (scope.mapped.length === 0 || scope.unmapped.length === 0) {
    return null;
  }
  const nouns = new Set(scope.unmapped.map((provider) => ITEM_NOUN[provider]));
  const noun = nouns.size === 1 ? [...nouns][0] : 'items';
  return `Project filter applies to ${labelList({ providers: scope.mapped })}. ${labelList({ providers: scope.unmapped })} ${noun} aren't tied to a project, so they stay listed.`;
};
