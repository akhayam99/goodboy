import { invokeCommand } from '../../../shared/lib/invokeCommand';

const FALLBACK_REMOTES: ReadonlyArray<string> = ['origin'];

type Params = {
  readonly cwd: string;
};

export const gitRemoteNames = async ({ cwd }: Params): Promise<ReadonlyArray<string>> => {
  try {
    const names = await invokeCommand<ReadonlyArray<string>>('git_remote_names', { cwd });
    return names.length > 0 ? names : FALLBACK_REMOTES;
  } catch {
    return FALLBACK_REMOTES;
  }
};
