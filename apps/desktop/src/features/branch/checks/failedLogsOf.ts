import { cleanLogText } from './cleanLogText';

type Params = {
  readonly text: string;
};

export type FailedLog = {
  readonly name: string;
  readonly text: string | null;
  readonly lineCount: number;
};

export const failedLogsOf = ({ text }: Params): ReadonlyArray<FailedLog> => {
  const logs: FailedLog[] = [];
  let pending: string[] = [];
  let fence = '';
  let name = '';
  let buffer: string[] = [];
  const flush = () => {
    const [first] = pending;
    if (first !== undefined) {
      logs.push({ name: first.trim(), text: null, lineCount: 0 });
    }
    pending = [];
  };
  for (const line of text.split('\n')) {
    if (fence === '') {
      const marker = /^(\x60{3,}|~{3,})/.exec(line.trimStart())?.[1];
      if (marker !== undefined) {
        fence = marker;
        name = pending[0]?.trim() ?? 'Log';
        pending = [];
        buffer = [];
        continue;
      }
      if (line.trim() === '') {
        flush();
        continue;
      }
      pending.push(line);
      continue;
    }
    const closing = /^(\x60{3,}|~{3,})$/.exec(line.trim())?.[1];
    if (closing !== undefined && closing[0] === fence[0] && closing.length >= fence.length) {
      const cleaned = cleanLogText({ text: buffer.join('\n') });
      logs.push({
        name,
        text: cleaned,
        lineCount: cleaned.length === 0 ? 0 : cleaned.split('\n').length,
      });
      fence = '';
      continue;
    }
    buffer.push(line);
  }
  flush();
  return logs;
};
