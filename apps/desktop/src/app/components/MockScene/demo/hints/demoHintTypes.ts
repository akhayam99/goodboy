import type { AppStore } from '../../../../../store/store';

export type HintProbe = {
  readonly state: AppStore;
  readonly start: AppStore;
  readonly root: Document;
  readonly isAnchorClicked: boolean;
};

type SettleParams = {
  readonly root: Document;
};

export type BlockParams = {
  readonly target: Element;
};

export type HintCheck = (probe: HintProbe) => boolean;

type HintAnchor = string | ((probe: HintProbe) => string | null);

export type HintSide = 'top' | 'bottom' | 'left' | 'right';

export type HintAlign = 'center' | 'end';

type HintRecovery = {
  readonly copy: string;
  readonly instruction: string;
  readonly side?: HintSide;
};

export type DemoHint = {
  readonly id: string;
  readonly label: string;
  readonly copy: string;
  readonly instruction: string;
  readonly result: string;
  readonly progress?: string;
  readonly progressCopy?: string;
  readonly beat: number;
  readonly anchor: HintAnchor;
  readonly recoveryAnchor?: HintAnchor;
  readonly recovery?: HintRecovery;
  readonly press?: string;
  readonly focus?: HintAnchor;
  readonly side?: HintSide;
  readonly isSideLocked?: boolean;
  readonly align?: HintAlign;
  readonly dwellMs?: number;
  readonly isDimmed?: boolean;
  readonly settle?: (params: SettleParams) => void;
  readonly isBlocked?: (params: BlockParams) => boolean;
  readonly revealWhen: HintCheck;
  readonly doneWhen: HintCheck;
};
