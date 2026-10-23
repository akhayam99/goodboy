import type { AppStore } from '../../../../../store/store';

export type HintProbe = {
  readonly state: AppStore;
  readonly start: AppStore;
  readonly root: Document;
  readonly isAnchorClicked: boolean;
};

export type HintCheck = (probe: HintProbe) => boolean;

type HintAnchor = string | ((probe: HintProbe) => string | null);

export type HintSide = 'top' | 'bottom' | 'left' | 'right';

export type DemoHint = {
  readonly id: string;
  readonly copy: string;
  readonly outcome: string | null;
  readonly anchor: HintAnchor;
  readonly side?: HintSide;
  readonly nextChapterId?: string;
  readonly revealWhen: HintCheck;
  readonly doneWhen: HintCheck;
};
