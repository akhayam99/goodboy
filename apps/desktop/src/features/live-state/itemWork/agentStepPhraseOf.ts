import type { TurnEvent } from '@goodboy/types';
import { toolCommandOf } from '../../chat/utils/toolCommandOf';
import { toolFilePath } from '../../chat/utils/toolFilePath';
import { THINKING_PHRASE, WRITING_PHRASE } from '../../chat/utils/livePhraseOf';
import { workingPhraseOf } from '../workingPhraseOf';

type Params = {
  readonly transcript: ReadonlyArray<TurnEvent>;
};

type TextParams = {
  readonly text: string;
};

type TextBlockParams = {
  readonly transcript: ReadonlyArray<TurnEvent>;
  readonly end: number;
};

const LIST_MARK = /^(?:[#>*+-]+|\d+[.)])\s+/;

const firstLineOf = ({ text }: TextParams): string =>
  text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '') ?? '';

const stepLineOf = ({ text }: TextParams): string => {
  const lines = text
    .split('\n')
    .map((line) => line.replaceAll('**', '').replaceAll('`', '').replace(LIST_MARK, '').trim())
    .filter((line) => line !== '');
  const line = lines.at(-1) ?? '';
  return line.endsWith(':') ? line.slice(0, -1).trimEnd() : line;
};

const textBlockOf = ({ transcript, end }: TextBlockParams): string => {
  const parts: Array<string> = [];
  for (let index = end; index >= 0; index -= 1) {
    const event = transcript[index];
    if (event?.kind !== 'assistant_text') {
      break;
    }
    parts.unshift(event.delta);
  }
  return parts.join('');
};

export const agentStepPhraseOf = ({ transcript }: Params): string => {
  const endedToolIds = new Set(
    transcript.flatMap((event) => (event.kind === 'tool_call_end' ? [event.toolUseId] : [])),
  );
  for (let index = transcript.length - 1; index >= 0; index -= 1) {
    const event = transcript[index];
    if (event?.kind === 'tool_call_start' && !endedToolIds.has(event.toolUseId)) {
      const command = toolCommandOf({ input: event.input });
      if (command !== null) {
        return `Running ${firstLineOf({ text: command })}`;
      }
      return workingPhraseOf({
        tool: { name: event.toolName, command: null, path: toolFilePath({ input: event.input }) },
        project: null,
      });
    }
    if (event?.kind === 'file_edit') {
      return workingPhraseOf({
        tool: { name: 'Edit', command: null, path: event.path },
        project: null,
      });
    }
    if (event?.kind === 'assistant_text') {
      const line = stepLineOf({ text: textBlockOf({ transcript, end: index }) });
      return line === '' ? WRITING_PHRASE : line;
    }
  }
  return THINKING_PHRASE;
};
