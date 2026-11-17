import type { Tone } from '@goodboy/ui';
import type { UpdaterState } from '../../store/slices/updater/state';
import type { UpdateCardState } from './updateCardState';

export type UpdateMarkGlyph = 'arrow' | 'alert';

export type UpdateMark = {
  readonly glyph: UpdateMarkGlyph;
  readonly tone: Extract<Tone, 'primary' | 'danger'>;
  readonly isEdged: boolean;
  readonly isDownloading: boolean;
  readonly percent: number | null;
  readonly word: string;
};

type PercentParams = {
  readonly progress: UpdaterState['updateProgress'];
};

type MarkParams = {
  readonly state: UpdateCardState;
  readonly status: UpdaterState['updaterStatus'];
  readonly progress: UpdaterState['updateProgress'];
};

const UPDATE_WORD = 'Update';

export const updateProgressPercent = ({ progress }: PercentParams): number | null => {
  if (progress === null || progress.total === null || progress.total <= 0) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round((progress.downloaded / progress.total) * 100)));
};

export const updateMarkOf = ({ state, status, progress }: MarkParams): UpdateMark => {
  if (state === 'failed') {
    return {
      glyph: 'alert',
      tone: 'danger',
      isEdged: true,
      isDownloading: false,
      percent: null,
      word: UPDATE_WORD,
    };
  }
  const isDownloading =
    status === 'downloading-bg' || (status === 'downloading' && progress !== null);
  if (isDownloading) {
    const percent = updateProgressPercent({ progress });
    return {
      glyph: 'arrow',
      tone: 'primary',
      isEdged: false,
      isDownloading: true,
      percent,
      word: percent === null ? UPDATE_WORD : `${percent}%`,
    };
  }
  return {
    glyph: 'arrow',
    tone: 'primary',
    isEdged: state !== 'available',
    isDownloading: false,
    percent: null,
    word: UPDATE_WORD,
  };
};
