import type { TranscriptItem } from '../chat/utils/transcript-items';

export type LastRunStep = {
  readonly command: string;
  readonly result: string;
};

type ToolCallItem = Extract<TranscriptItem, { kind: 'tool_call' }>;

const MAX_COMMAND_LENGTH = 80;
const FAILING_COUNT = /(\d+)\s+(?:failing|failed)\b/i;

const stringField = ({
  value,
  key,
}: {
  readonly value: unknown;
  readonly key: string;
}): string | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const field: unknown = Reflect.get(value, key);
  return typeof field === 'string' ? field : null;
};

const commandOf = ({ item }: { readonly item: ToolCallItem }): string | null => {
  const command = stringField({ value: item.input, key: 'command' })?.trim() ?? '';
  if (command === '') {
    return null;
  }
  const firstLine = command.split('\n')[0]?.trim() ?? '';
  return firstLine.length > MAX_COMMAND_LENGTH
    ? `${firstLine.slice(0, MAX_COMMAND_LENGTH - 1)}…`
    : firstLine;
};

const outputTextOf = ({ output }: { readonly output: unknown }): string => {
  if (typeof output === 'string') {
    return output;
  }
  if (Array.isArray(output)) {
    return output.map((part) => outputTextOf({ output: part })).join('\n');
  }
  return ['stdout', 'stderr', 'output', 'text', 'content']
    .map((key) => stringField({ value: output, key }))
    .filter((text): text is string => text !== null)
    .join('\n');
};

const resultOf = ({ item }: { readonly item: ToolCallItem }): string => {
  if (!item.ended) {
    return 'did not finish';
  }
  if (!item.isError) {
    return 'passed';
  }
  const count = FAILING_COUNT.exec(outputTextOf({ output: item.output }))?.[1];
  return count === undefined ? 'failed' : `${count} failing`;
};

export const lastRunStep = ({
  items,
}: {
  readonly items: ReadonlyArray<TranscriptItem>;
}): LastRunStep | null => {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item?.kind !== 'tool_call') {
      continue;
    }
    const command = commandOf({ item });
    if (command !== null) {
      return { command, result: resultOf({ item }) };
    }
  }
  return null;
};
