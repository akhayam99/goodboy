import { CommandError } from '../../../shared/lib/invokeCommand';

type GitlabFailureKind = 'bad_credentials' | 'denied' | 'rate_limited' | 'network' | 'failed';

export type GitlabFailure = {
  readonly status: number | null;
  readonly body: string;
};

const HTTP_MESSAGE = /^http error (\d+): ([\s\S]*)$/;

export const classifyGitlabFailure = ({ status }: GitlabFailure): GitlabFailureKind => {
  if (status === 401) {
    return 'bad_credentials';
  }
  if (status === 403) {
    return 'denied';
  }
  if (status === 429) {
    return 'rate_limited';
  }
  return status === 0 ? 'network' : 'failed';
};

export const gitlabFailureOf = ({ error }: { readonly error: unknown }): GitlabFailure => {
  if (!(error instanceof CommandError)) {
    return { status: null, body: error instanceof Error ? error.message : String(error) };
  }
  if (error.kind === 'timeout') {
    return { status: 0, body: error.message };
  }
  if (error.kind === 'no_token') {
    return { status: 401, body: error.message };
  }
  const match = error.kind === 'http' ? HTTP_MESSAGE.exec(error.message) : null;
  if (match === null) {
    return { status: null, body: error.message };
  }
  return { status: Number(match[1]), body: match[2] ?? '' };
};
