import type { MobileAction } from '../contract/actions';

export const DECIDE_KINDS = [
  'answerQuestion',
  'approvePlan',
  'requestPlanChanges',
  'answerPermission',
  'raiseLimit',
  'undoRaiseLimit',
  'stopRun',
  'continueRun',
  'stopAgent',
  'continueAgent',
  'answerSlackReply',
] as const satisfies ReadonlyArray<MobileAction['kind']>;

export type DecideKind = (typeof DECIDE_KINDS)[number];

export type DecideAction = Extract<MobileAction, { readonly kind: DecideKind }>;

export type DecideActionOf<Kind extends DecideKind> = Extract<
  DecideAction,
  { readonly kind: Kind }
>;

type KindParams = {
  readonly kind: string;
};

export const decideKindOf = ({ kind }: KindParams): DecideKind | null =>
  DECIDE_KINDS.find((candidate) => candidate === kind) ?? null;
