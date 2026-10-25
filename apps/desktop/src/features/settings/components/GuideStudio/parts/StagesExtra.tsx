import type { SessionStage } from '@goodboy/types';
import { cn, ICON_SIZE, tintClasses } from '@goodboy/ui';
import { ARCHIVED_LANE, describeStageBucket } from '../../../../session/session-stage';
import type { StatePresentation } from '../../../../../shared/utils/statePresentation';
import { Block } from './Block';

const STAGE_ORDER: ReadonlyArray<SessionStage> = [
  'building',
  'running',
  'attention',
  'review',
  'done',
];

const LANES: ReadonlyArray<StatePresentation> = [
  ...STAGE_ORDER.map((stage) => describeStageBucket({ stage })),
  ARCHIVED_LANE,
];

type SentenceParams = {
  readonly text: string;
};

const asSentence = ({ text }: SentenceParams): string =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;

type Props = Record<never, never>;

export const StagesExtra = ({}: Props) => (
  <Block title="The columns, left to right">
    <ul className="flex flex-col gap-2">
      {LANES.map(({ label, reason, tone, icon: Icon }) => (
        <li
          key={label}
          className="flex items-start gap-3 rounded-md border border-border-soft bg-subtle px-3 py-3"
        >
          <span
            className={cn(
              'flex size-5 shrink-0 items-center justify-center',
              tintClasses(tone).text,
            )}
          >
            <Icon size={ICON_SIZE.row} aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-heading text-foreground">{label}</span>
            <span className="text-prose text-muted-foreground">{asSentence({ text: reason })}</span>
          </div>
        </li>
      ))}
    </ul>
  </Block>
);
