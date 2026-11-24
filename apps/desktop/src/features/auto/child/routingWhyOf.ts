import { CANDIDATE_CAUSES } from '@goodboy/core/providers';
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
};

const weighedRowOf = ({
  row,
  index,
  pick,
  asked,
  isPickTaken,
}: CandidateParams): RoutingWhyCandidate | null => {
  const provider = textField({ source: row, key: 'provider' });
  const model = textField({ source: row, key: 'model' });
  if (provider === null || model === null) {
    return null;
  }
  const effort = textField({ source: row, key: 'effort' });
  const cause = textField({ source: row, key: 'cause' });
  const isStruck = cause !== null;
  const isPick = !isStruck && !isPickTaken && pick.provider === provider && pick.model === model;
  const isAsked =
    isStruck && asked !== null && asked.provider === provider && asked.model === model;
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
  return provider === null || model === null ? null : { provider, model };
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
  const isMoved = source === 'fallback' || textField({ source: routing, key: 'cause' }) !== null;
  const modelName = modelLineOf({ provider, model, effort: null })?.name ?? model;
  const split = splitReason({ reason, heads: [providerLabel, modelName] });
  const isLeadWords = (source === 'lead' || source === 'lock') && modelReason !== null;
  return {
    providerLabel,
    whyLabel: isLeadWords
      ? `Why the Lead chose ${providerLabel}: `
      : `Why ${split.head ?? providerLabel}: `,
    why: isLeadWords ? modelReason : split.body,
    leadSaid: isMoved ? modelReason : null,
    isMoved,
    candidates: candidatesOf({
      routing,
      pick: { provider, model },
      asked: isMoved ? askedOf({ routing }) : null,
    }),
  };
};
