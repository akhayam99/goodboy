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
  readonly label: string;
  readonly copy: string;
  readonly instruction: string;
  readonly result: string;
  readonly progress?: string;
  readonly beat: number;
  readonly anchor: HintAnchor;
  readonly focus?: HintAnchor;
  readonly side?: HintSide;
  readonly revealWhen: HintCheck;
  readonly doneWhen: HintCheck;
};
