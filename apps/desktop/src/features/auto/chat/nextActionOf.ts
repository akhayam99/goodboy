import { parseAutoDelegationRole, type AutoDelegationRole } from '@goodboy/core';
import type { AutoDelegation } from '@goodboy/db';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import type { DelegationCardModel } from './delegationCardOf';
import { isJsonRecord, listField, textField } from './readJson';

export type NextActionChoice = Readonly<{
  key: string;
  label: string;
  role: AutoDelegationRole | null;
}>;

export type NextAction = Readonly<{
  delegationId: string;
  title: string;
  choices: ReadonlyArray<NextActionChoice>;
}>;

type Params = {
  readonly view: AutoTreeView;
  readonly delegation: AutoDelegation;
  readonly card: DelegationCardModel;
};

const MAX_CHOICES = 3;

const primaryLabelOf = ({ view, delegation, card }: Params): string => {
  const row =
    delegation.reviseOf === null
      ? undefined
      : view.artifacts.find((candidate) => candidate.artifact.artifactId === delegation.reviseOf);
  return row === undefined
    ? `Spawn ${card.roleLabel.toLowerCase()}`
    : `Revise ${row.title} to v${row.revision + 1}`;
};

const alternativesOf = ({
  delegation,
}: Pick<Params, 'delegation'>): ReadonlyArray<NextActionChoice> =>
  listField({ source: delegation.request, key: 'alternatives' }).flatMap(
    (raw, index): ReadonlyArray<NextActionChoice> => {
      const label = textField({ source: raw, key: 'label' });
      const role = isJsonRecord(raw) ? parseAutoDelegationRole({ role: raw['role'] }) : null;
      return label === null || role === null ? [] : [{ key: `alternative-${index}`, label, role }];
    },
  );

export const nextActionOf = ({ view, delegation, card }: Params): NextAction => ({
  delegationId: delegation.id,
  title: card.task ?? card.roleLabel,
  choices: [
    { key: 'primary', label: primaryLabelOf({ view, delegation, card }), role: null },
    ...alternativesOf({ delegation }),
  ].slice(0, MAX_CHOICES),
});

type MessageParams = {
  readonly choice: NextActionChoice;
  readonly hint: string;
};

export const nextStepMessageOf = ({ choice, hint }: MessageParams): string => {
  const head = `Next step: ${choice.role ?? 'other'}`;
  const note = hint.trim();
  return note === '' ? head : `${head}\n${note}`;
};
