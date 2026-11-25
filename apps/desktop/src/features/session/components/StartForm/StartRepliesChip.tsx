import { Button } from '@goodboy/ui';
import { openRunDefaults } from '../../../settings/openRunDefaults';
import { START_KIND_COPY } from '../../startKind/startKindCopy';

type Props = {
  readonly value: string;
  readonly isDisabled: boolean;
};

const LABEL = START_KIND_COPY.words.replies;

export const StartRepliesChip = ({ value, isDisabled }: Props) => (
  <Button
    size="xs"
    variant="setting"
    disabled={isDisabled}
    aria-label={`${LABEL}: ${value}. ${START_KIND_COPY.defaultsDoor}`}
    data-setting-chip={LABEL}
    onClick={openRunDefaults}
    className="max-w-full"
  >
    <span className="shrink-0 text-faint-foreground">{LABEL}:</span>
    <span className="min-w-0 max-w-56 truncate text-eyebrow text-foreground">{value}</span>
  </Button>
);
