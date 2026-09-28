import { CHIP_LABEL, type ChipKind } from '../../data/harborline';

type Props = {
  readonly kind: ChipKind;
  readonly text?: string;
  readonly isOff?: boolean;
};

export const StateChip = ({ kind, text, isOff = false }: Props) => (
  <span
    className={['mk-chip', `is-${kind}`, isOff ? 'is-off' : null].filter(Boolean).join(' ')}
    aria-hidden={isOff ? true : undefined}
  >
    <span className="mk-spin" aria-hidden="true" />
    <span>{text ?? CHIP_LABEL[kind]}</span>
  </span>
);
