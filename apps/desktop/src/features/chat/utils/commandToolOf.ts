import type { TranscriptItem } from './transcript-items';
import { toolKind } from './toolKind';

type ToolItem = Extract<TranscriptItem, { kind: 'tool_call' }>;

type ItemParams = {
  readonly item: ToolItem;
};

type ValueParams = {
  readonly value: unknown;
};

export type CommandTool = {
  readonly command: string;
  readonly output: string | null;
  readonly exitCode: number | null;
};

const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;

const commandOf = ({ value }: ValueParams): string | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const command: unknown = Reflect.get(value, 'command');
  const text = Array.isArray(command) ? command.join(' ') : command;
  return typeof text === 'string' && text.trim() !== '' ? text : null;
};

const textOfPart = ({ value }: ValueParams): string | null => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const text: unknown = Reflect.get(value, 'text');
  return typeof text === 'string' ? text : null;
};

type ValuesParams = {
  readonly values: ReadonlyArray<unknown>;
};

const joinedText = ({ values }: ValuesParams): string | null => {
  const parts = values.map((value) => textOfPart({ value }));
  return parts.every((part) => part !== null) ? parts.join('\n') : null;
};

const objectText = ({ value }: ValueParams): string | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const aggregated: unknown = Reflect.get(value, 'aggregated_output');
  if (typeof aggregated === 'string') {
    return aggregated;
  }
  const output: unknown = Reflect.get(value, 'output');
  if (typeof output === 'string') {
    return output;
  }
  const stdout: unknown = Reflect.get(value, 'stdout');
  const stderr: unknown = Reflect.get(value, 'stderr');
  const streams = [stdout, stderr].filter((stream) => typeof stream === 'string' && stream !== '');
  return typeof stdout === 'string' || typeof stderr === 'string' ? streams.join('\n') : null;
};

const outputOf = ({ value }: ValueParams): string | null => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return joinedText({ values: value });
  }
  return objectText({ value });
};

const exitCodeOf = ({ value }: ValueParams): number | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const code: unknown = Reflect.get(value, 'exit_code') ?? Reflect.get(value, 'exitCode');
  return typeof code === 'number' ? code : null;
};

const MAX_SUBJECT = 48;

type SubjectParams = {
  readonly command: string;
};

export const commandSubjectOf = ({ command }: SubjectParams): string => {
  const line = command.split('\n')[0]?.trim() ?? '';
  return line.length > MAX_SUBJECT ? `${line.slice(0, MAX_SUBJECT)}…` : line;
};

export const commandToolOf = ({ item }: ItemParams): CommandTool | null => {
  if (toolKind({ toolName: item.toolName }) !== 'command') {
    return null;
  }
  const command = commandOf({ value: item.input });
  if (command === null) {
    return null;
  }
  if (!item.ended) {
    return { command, output: null, exitCode: null };
  }
  const output = outputOf({ value: item.output });
  return {
    command,
    output: output === null ? null : output.replace(ANSI_PATTERN, ''),
    exitCode: exitCodeOf({ value: item.output }),
  };
};
