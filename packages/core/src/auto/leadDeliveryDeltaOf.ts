import {
  joinDeliveryParts,
  type LeadDeliveryPart,
  type LeadDeliverySent,
} from './leadDeliveryPart';
import { LEAD_DELIVERY_MARK } from './leadDeliveryMark';

type ListItem = Readonly<{
  id: string;
  text: string;
}>;

type SplitList = Readonly<{
  head: string;
  items: ReadonlyArray<ListItem>;
}>;

type LineParams = {
  readonly line: string;
};

const itemIdOf = ({ line }: LineParams): string => {
  if (line.startsWith('- ')) {
    return `- ${line.slice(2).split(' ', 1)[0] ?? ''}`;
  }
  const colon = line.indexOf(':');
  return colon > 0 ? line.slice(0, colon) : line;
};

type TextParams = {
  readonly text: string;
};

const splitList = ({ text }: TextParams): SplitList => {
  const [head = '', ...rest] = text.split('\n');
  const items: ListItem[] = [];
  for (const line of rest) {
    const last = items.at(-1);
    if (line.startsWith('  ') && last !== undefined) {
      items[items.length - 1] = { id: last.id, text: `${last.text}\n${line}` };
      continue;
    }
    items.push({ id: itemIdOf({ line }), text: line });
  }
  return { head, items };
};

type ChangedListParams = {
  readonly previous: string;
  readonly next: string;
};

const changedListText = ({ previous, next }: ChangedListParams): string | null => {
  if (previous === next) {
    return null;
  }
  const before = splitList({ text: previous });
  const after = splitList({ text: next });
  const beforeById = new Map(before.items.map((item) => [item.id, item.text]));
  const afterIds = new Set(after.items.map((item) => item.id));
  const isUnkeyed =
    before.items.length === 0 ||
    after.items.length === 0 ||
    beforeById.size !== before.items.length ||
    afterIds.size !== after.items.length;
  if (isUnkeyed || before.items.some((item) => !afterIds.has(item.id))) {
    return [after.head, LEAD_DELIVERY_MARK.wholeList, ...after.items.map((item) => item.text)].join(
      '\n',
    );
  }
  const changed = after.items.filter((item) => beforeById.get(item.id) !== item.text);
  if (changed.length === 0) {
    return null;
  }
  return [after.head, ...changed.map((item) => item.text)].join('\n');
};

type PartParams = {
  readonly part: LeadDeliveryPart;
  readonly sent: LeadDeliverySent;
};

const changedPartOf = ({ part, sent }: PartParams): ReadonlyArray<LeadDeliveryPart> => {
  const previous = sent.get(part.name);
  if (part.kind === 'news' || previous === undefined) {
    return [part];
  }
  if (part.text === '') {
    return previous === ''
      ? []
      : [{ ...part, text: `${part.name}: ${LEAD_DELIVERY_MARK.cleared}` }];
  }
  if (part.kind === 'state') {
    return previous === part.text ? [] : [part];
  }
  const changed = changedListText({ previous, next: part.text });
  return changed === null ? [] : [{ ...part, text: changed }];
};

export type LeadDeliveryDeltaParams = Readonly<{
  parts: ReadonlyArray<LeadDeliveryPart>;
  sent: LeadDeliverySent;
}>;

export const leadDeliveryDeltaOf = ({ parts, sent }: LeadDeliveryDeltaParams): string =>
  joinDeliveryParts({ parts: parts.flatMap((part) => changedPartOf({ part, sent })) });
