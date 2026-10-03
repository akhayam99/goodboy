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

const PLACE: Readonly<Record<LinkScope, string>> = {
  session: 'this session',
  branch: 'this branch',
  workspace: 'the Board',
};

export const SCOPE_TAB_LABEL: Readonly<Record<LinkScope, string>> = {
  session: 'This session',
  branch: 'This branch',
  workspace: 'Whole workspace',
};

const SCOPE_ORDER: ReadonlyArray<LinkScope> = ['session', 'branch', 'workspace'];

const AND = new Intl.ListFormat('en', { type: 'conjunction' });

export const linkedLabel = ({ scopes }: { readonly scopes: ReadonlyArray<LinkScope> }): string =>
  `Linked to ${AND.format(SCOPE_ORDER.filter((scope) => scopes.includes(scope)).map((scope) => PLACE[scope]))}`;

export const freeScope = ({
  scopes,
  hasBranch,
}: {
  readonly scopes: ReadonlyArray<LinkScope>;
  readonly hasBranch: boolean;
}): LinkScope | null =>
  SCOPE_ORDER.find((scope) => !scopes.includes(scope) && (scope !== 'branch' || hasBranch)) ?? null;
