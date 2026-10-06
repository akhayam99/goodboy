import type { LucideIcon } from 'lucide-react';
import { Chip, tintClasses, type Tone } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import type { AskHandle, AskTarget } from '../../askHandles';

type Props = {
  readonly handle: AskHandle;
  readonly onOpen: (handle: AskHandle) => void;
};

type Glyph = {
  readonly icon: LucideIcon;
  readonly tone: Tone;
};

const GLYPH: Readonly<Record<AskTarget['kind'], Glyph>> = {
  agent: { icon: CONCEPT_ICONS.agents, tone: 'success' },
  run: { icon: CONCEPT_ICONS.workflows, tone: 'primary' },
  question: { icon: CONCEPT_ICONS.questions, tone: 'warning' },
  comment: { icon: CONCEPT_ICONS.comments, tone: 'info' },
  pr: { icon: CONCEPT_ICONS.pr, tone: 'info' },
  artifact: { icon: CONCEPT_ICONS.plans, tone: 'warning' },
  file: { icon: CONCEPT_ICONS.diff, tone: 'info' },
};

export const AskChip = ({ handle, onOpen }: Props) => {
  const glyph = GLYPH[handle.target.kind];
  const Icon = glyph.icon;
  return (
    <Chip
      as="button"
      tone="neutral"
      size="xs"
      testId="ask-chip"
      ariaLabel={`Open ${handle.label}`}
      icon={<Icon size={ICON_SIZE.row} aria-hidden className={tintClasses(glyph.tone).icon} />}
      label={handle.label}
      onClick={() => onOpen(handle)}
    />
  );
};
