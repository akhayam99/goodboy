import type { ScriptRunRecord } from './scripts';

type Params = {
  readonly record: ScriptRunRecord | null;
};

export const scriptRecordOutput = ({ record }: Params): string => {
  if (record === null) {
    return '';
  }
  const stdout = record.result?.stdout ?? record.output ?? '';
  const stderr = record.result?.stderr ?? '';
  return stderr === '' ? stdout : `${stdout}${stdout === '' ? '' : '\n'}${stderr}`;
};
