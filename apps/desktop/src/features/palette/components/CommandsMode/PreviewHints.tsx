import type { PaletteEntry } from '../../types';

type Props = {
  readonly entry: PaletteEntry;
  readonly isActionsLevel: boolean;
  readonly hasOtherModes: boolean;
};

const enterLabel = (entry: PaletteEntry): string => {
  if (entry.isBlocked === true) {
    return 'Unavailable';
  }
  if (entry.kind === 'verb' || entry.kind === 'action' || entry.kind === 'goto') {
    return entry.label;
  }
  return 'Open';
};

export const PreviewHints = ({ entry, isActionsLevel, hasOtherModes }: Props) => {
  const hints = [
    `↵ ${enterLabel(entry)}`,
    ...(!isActionsLevel && entry.target !== undefined && entry.kind !== 'verb'
      ? ['→ All actions']
      : []),
    ...(isActionsLevel ? ['← Back'] : []),
    ...(hasOtherModes && !isActionsLevel ? ['⇥ Search'] : []),
  ];
  return <p className="truncate text-label text-faint-foreground">{hints.join(' · ')}</p>;
};
