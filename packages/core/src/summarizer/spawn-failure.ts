import type { ProviderId } from '@goodboy/types';
import { extractAuxOutput } from '../providers/aux-output';

const MAX_DETAIL_CHARS = 400;
const MAX_STDERR_LINES = 3;
const ANSI_PATTERN = /\u001b\[[0-9;]*[A-Za-z]/g;

type Params = {
  readonly providerId: ProviderId;
  readonly stdout: string;
  readonly stderr: string;
};

const reportedByStdout = ({ providerId, stdout }: Omit<Params, 'stderr'>): string | null => {
  if (stdout.trim() === '') {
    return null;
  }
  try {
    const output = extractAuxOutput({ providerId, stdout });
    const message = output.errorMessage?.trim() ?? '';
    return output.isError && message !== '' ? message : null;
  } catch {
    return null;
  }
};

const stderrTail = ({ stderr }: Pick<Params, 'stderr'>): string | null => {
  const lines = stderr
    .replace(ANSI_PATTERN, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  return lines.length === 0 ? null : lines.slice(-MAX_STDERR_LINES).join(' ');
};

export const cliFailureDetail = ({ providerId, stdout, stderr }: Params): string => {
  const detail = reportedByStdout({ providerId, stdout }) ?? stderrTail({ stderr }) ?? '';
  return detail.length > MAX_DETAIL_CHARS ? `${detail.slice(0, MAX_DETAIL_CHARS)}...` : detail;
};
