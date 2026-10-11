import { PenLine } from 'lucide-react';
import { Chip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { HOST_GLYPH, kindLabelOf } from './threadKind';
import type { DiffThread } from './types';

type Props = {
  readonly thread: DiffThread;
};

export const ThreadKindChip = ({ thread }: Props) => {
  const Glyph = thread.source === 'host' ? HOST_GLYPH[thread.host ?? 'github'] : PenLine;
  return (
    <Chip
      tone="neutral"
      kind="state"
      bordered={false}
      icon={<Glyph size={ICON_SIZE.mark} aria-hidden />}
      label={kindLabelOf({ thread })}
    />
  );
};
