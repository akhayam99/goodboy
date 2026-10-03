import type { SessionStage } from '@goodboy/types';
import { Chip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { SESSION_STAGE_ICON, SESSION_STAGE_META, STAGE_TONE } from '../../../session/session-stage';

const STAGES: ReadonlyArray<SessionStage> = ['attention', 'running', 'review', 'building', 'done'];

const sentenceCase = ({ text }: { readonly text: string }): string =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

export const EmptyBoardStages = () => (
  <ul aria-label="Board stages" className="flex max-w-sm flex-wrap justify-center gap-1.5">
    {STAGES.map((stage) => {
      const Icon = SESSION_STAGE_ICON[stage];
      return (
        <li key={stage}>
          <Chip
            tone={STAGE_TONE[stage]}
            size="md"
            icon={<Icon size={ICON_SIZE.row} aria-hidden />}
            label={sentenceCase({ text: SESSION_STAGE_META[stage].label })}
            trailing={<span className="tabular-nums">0</span>}
          />
        </li>
      );
    })}
  </ul>
);
