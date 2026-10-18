import { Chip, type Tone } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { UpdateCardState } from '../../updateCardState';
import { UpdateCardMark } from '../UpdateCardMark';

type Props = {
  readonly state: UpdateCardState;
  readonly version: string | null;
};

const TONE_BY_STATE = {
  available: 'primary',
  ready: 'primary',
  running: 'primary',
  failed: 'danger',
  queued: 'info',
} as const satisfies Record<UpdateCardState, Tone>;

export const UpdatePillVisual = ({ state, version }: Props) => (
  <span className="inline-flex min-w-0 max-w-full rounded-full motion-safe:animate-studio-body-in">
    <Chip
      tone={TONE_BY_STATE[state]}
      emphasis="soft"
      shape="pill"
      icon={
        <span className="flex shrink-0">
          <UpdateCardMark state={state} size={ICON_SIZE.mark} />
        </span>
      }
      label={
        <span data-update-pill-version="" className="min-w-0 truncate tabular-nums">
          {version ?? 'Update'}
        </span>
      }
      className="min-w-0 max-w-full shrink whitespace-nowrap"
      testId="update-pill"
    />
  </span>
);
