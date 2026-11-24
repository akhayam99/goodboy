import { CANDIDATE_CAUSES, catalogModelForId } from '@goodboy/core/providers';
import type { AutoRoutingSource, ProviderId } from '@goodboy/types';
import { isProviderId } from '@goodboy/types/helpers';
import { modelLineOf } from '../../providers/modelLine/modelLineOf';
import { PROVIDER_LABEL } from '../../providers/providerLabel';
import { isJsonRecord, listField, numberField, recordField, textField } from '../chat/readJson';

export type RoutingWhyCandidate = Readonly<{
  key: string;
  provider: ProviderId | null;
  providerLabel: string;
  modelLabel: string;
  facts: string;
  isPick: boolean;
  isAsked: boolean;
  isStruck: boolean;
}>;

export type RoutingWhyModel = Readonly<{
  providerLabel: string;
  whyLabel: string;
  why: string;
  leadSaid: string | null;
  isMoved: boolean;
  candidates: ReadonlyArray<RoutingWhyCandidate>;
}>;

type RoutedModel = Readonly<{
  provider: string;
  model: string;
  effort: string | null;
}>;

const SOURCES: ReadonlyArray<AutoRoutingSource> = ['lead', 'pin', 'rule', 'fallback', 'lock'];

type SourceParams = {
  readonly value: string | null;
};

const pickSourceOf = ({ value }: SourceParams): AutoRoutingSource | null =>
  SOURCES.find((source) => source === value) ?? null;

const CAUSE_TEXT: ReadonlyMap<string, string> = new Map(
  Object.entries(CANDIDATE_CAUSES).map(([cause, copy]) => [cause, copy.text]),
);

type CauseParams = {
  readonly cause: string;
};

const causeText = ({ cause }: CauseParams): string =>
  CAUSE_TEXT.get(cause) ?? CANDIDATE_CAUSES['not-listed'].text;

type LabelParams = {
  readonly provider: string;
};

const providerLabelOf = ({ provider }: LabelParams): string =>
  isProviderId(provider) ? PROVIDER_LABEL[provider] : provider;

type ModelParams = {
  readonly provider: string;
  readonly model: string;
  readonly effort: string | null;
};

type KeyParams = {
  readonly provider: string;
  readonly model: string;
};

const modelKeyOf = ({ provider, model }: KeyParams): string => {
  const key = isProviderId(provider) ? catalogModelForId({ provider, modelId: model })?.key : null;
  return key == null ? `id:${model}` : `catalog:${key}`;
};

type SameParams = {
  readonly routed: RoutedModel;
  readonly provider: string;
  readonly model: string;
  readonly effort: string | null;
};

const isSameRow = ({ routed, provider, model, effort }: SameParams): boolean =>
  routed.provider === provider &&
  modelKeyOf({ provider, model: routed.model }) === modelKeyOf({ provider, model }) &&
  (routed.effort === null || routed.effort === effort);

const modelLabelOf = ({ provider, model, effort }: ModelParams): string => {
  const line = modelLineOf({ provider, model, effort });
  if (line === null) {
    return model;
  }
  return line.effort === null ? line.name : `${line.name} · ${line.effort}`;
};

type RowParams = {
  readonly row: unknown;
};

const roomText = ({ row }: RowParams): string => {
  const room = recordField({ source: row, key: 'room' });
  const used = numberField({ source: room, key: 'usedPercent' });
  if (room === null || used === null) {
    return 'no usage reading';
  }
  const rounded = Math.round(used);
  return room['isEstimated'] === true ? `about ${rounded}% used, estimated` : `${rounded}% used`;
};

const usableFacts = ({ row }: RowParams): string => {
  const order = numberField({ source: row, key: 'order' });
  const load = numberField({ source: row, key: 'load' }) ?? 0;
  return [
    ...(order === null ? [] : [`#${order} in your order`]),
    roomText({ row }),
    `${load} ${load === 1 ? 'agent' : 'agents'} in the last hour`,
    ...(isJsonRecord(row) && row['isLighter'] === true ? ['lighter model'] : []),
  ].join(' · ');
};

type CandidateParams = {
  readonly row: unknown;
  readonly index: number;
  readonly pick: RoutedModel;
  readonly asked: RoutedModel | null;
  readonly isPickTaken: boolean;
  readonly isAskedTaken: boolean;
};

const weighedRowOf = ({
  row,
  index,
  pick,
  asked,
  isPickTaken,
  isAskedTaken,
}: CandidateParams): RoutingWhyCandidate | null => {
  const provider = textField({ source: row, key: 'provider' });
  const model = textField({ source: row, key: 'model' });
  if (provider === null || model === null) {
    return null;
  }
  const effort = textField({ source: row, key: 'effort' });
  const cause = textField({ source: row, key: 'cause' });
  const isStruck = cause !== null;
  const isPick = !isStruck && !isPickTaken && isSameRow({ routed: pick, provider, model, effort });
  const isAsked =
    isStruck &&
    !isAskedTaken &&
    asked !== null &&
    isSameRow({ routed: asked, provider, model, effort });
  const facts =
    cause === null
      ? usableFacts({ row })
      : [...(isAsked ? ['asked by the Lead'] : []), causeText({ cause })].join(' · ');
  return {
    key: `${provider}:${model}:${effort ?? ''}:${index}`,
    provider: isProviderId(provider) ? provider : null,
    providerLabel: providerLabelOf({ provider }),
    modelLabel: modelLabelOf({ provider, model, effort }),
    facts,
    isPick,
    isAsked,
    isStruck,
  };
};

type CandidatesParams = {
  readonly routing: unknown;
  readonly pick: RoutedModel;
  readonly asked: RoutedModel | null;
};

const candidatesOf = ({
  routing,
  pick,
  asked,
}: CandidatesParams): ReadonlyArray<RoutingWhyCandidate> =>
  listField({ source: routing, key: 'candidates' }).reduce<ReadonlyArray<RoutingWhyCandidate>>(
    (rows, row, index) => {
      const candidate = weighedRowOf({
        row,
        index,
        pick,
        asked,
        isPickTaken: rows.some((taken) => taken.isPick),
        isAskedTaken: rows.some((taken) => taken.isAsked),
      });
      return candidate === null ? rows : [...rows, candidate];
    },
    [],
  );

type SplitParams = {
  readonly reason: string;
  readonly heads: ReadonlyArray<string>;
};

type Split = Readonly<{
  head: string | null;
  body: string;
}>;

const splitReason = ({ reason, heads }: SplitParams): Split => {
  const at = reason.indexOf(': ');
  if (at <= 0) {
    return { head: null, body: reason };
  }
  const head = reason.slice(0, at);
  return heads.includes(head) ? { head, body: reason.slice(at + 2) } : { head: null, body: reason };
};

type AskedParams = {
  readonly routing: unknown;
};

const askedOf = ({ routing }: AskedParams): RoutedModel | null => {
  const requested = recordField({ source: routing, key: 'requested' });
  const provider = textField({ source: requested, key: 'provider' });
  const model = textField({ source: requested, key: 'model' });
  const effort = textField({ source: requested, key: 'effort' });
  return provider === null || model === null ? null : { provider, model, effort };
};

type EffortWordParams = {
  readonly routed: RoutedModel;
};

const effortWordOf = ({ routed }: EffortWordParams): string | null =>
  routed.effort === null ? null : (modelLineOf({ ...routed })?.effort ?? routed.effort);

type AdjustedParams = {
  readonly pick: RoutedModel;
  readonly asked: RoutedModel | null;
};

const adjustedLineOf = ({ pick, asked }: AdjustedParams): string => {
  const askedWord = asked === null ? null : effortWordOf({ routed: asked });
  const usedWord = effortWordOf({ routed: pick });
  const askedName = modelLineOf({ ...(asked ?? pick), effort: null })?.name ?? pick.model;
  const askedPart =
    askedWord === null
      ? `The Lead asked for ${askedName} at another effort, not offered here.`
      : `The Lead asked for ${askedName} at ${askedWord} effort, not offered here.`;
  return usedWord === null
    ? `${askedPart} It runs at its default effort.`
    : `${askedPart} It runs at ${usedWord} effort.`;
};

type Params = {
  readonly routing: unknown;
};

export const routingWhyOf = ({ routing }: Params): RoutingWhyModel | null => {
  const source = pickSourceOf({ value: textField({ source: routing, key: 'source' }) });
  const provider = textField({ source: routing, key: 'provider' });
  const model = textField({ source: routing, key: 'model' });
  const reason = textField({ source: routing, key: 'reason' });
  if (source === null || provider === null || model === null || reason === null) {
    return null;
  }
  const providerLabel = providerLabelOf({ provider });
  const modelReason = textField({ source: routing, key: 'modelReason' });
  const isAdjusted = textField({ source: routing, key: 'proposal' }) === 'adjusted';
  const isMoved =
    isAdjusted || source === 'fallback' || textField({ source: routing, key: 'cause' }) !== null;
  const modelName = modelLineOf({ provider, model, effort: null })?.name ?? model;
  const split = splitReason({ reason, heads: [providerLabel, modelName] });
  const isLeadWords = !isMoved && (source === 'lead' || source === 'lock') && modelReason !== null;
  const pick = { provider, model, effort: textField({ source: routing, key: 'effort' }) };
  const asked = isMoved ? askedOf({ routing }) : null;
  const movedWhy = isAdjusted ? adjustedLineOf({ pick, asked }) : split.body;
  return {
    providerLabel,
    whyLabel: isLeadWords
      ? `Why the Lead chose ${providerLabel}: `
      : `Why ${isAdjusted ? providerLabel : (split.head ?? providerLabel)}: `,
    why: isLeadWords ? modelReason : movedWhy,
    leadSaid: isMoved ? modelReason : null,
    isMoved,
    candidates: candidatesOf({ routing, pick, asked }),
  };
};
