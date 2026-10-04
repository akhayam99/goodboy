import type { ExternalTaskRelation } from '@goodboy/types';

export type LinkScope = 'session' | 'workspace';

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
  workspace: 'the Board',
};

export const SCOPE_TAB_LABEL: Readonly<Record<LinkScope, string>> = {
  session: 'This session',
  workspace: 'Whole workspace',
};

const SCOPE_ORDER: ReadonlyArray<LinkScope> = ['session', 'workspace'];

const AND = new Intl.ListFormat('en', { type: 'conjunction' });

export const linkedLabel = ({ scopes }: { readonly scopes: ReadonlyArray<LinkScope> }): string =>
  `Linked to ${AND.format(SCOPE_ORDER.filter((scope) => scopes.includes(scope)).map((scope) => PLACE[scope]))}`;
