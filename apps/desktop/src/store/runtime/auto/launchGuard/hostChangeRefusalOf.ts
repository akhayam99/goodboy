import {
  changeGateOf,
  changeRefusalOf,
  isChangeGateOn,
  type ChangeRules,
} from '@goodboy/core/auto';
import type { SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import type { AutoPorts } from '../ports';

export type HostChangeRefusal = Readonly<{
  message: string;
  isRetryable: boolean;
}>;

type Params = {
  readonly ports: AutoPorts;
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly branch: string;
  readonly sha: string;
  readonly changes: ChangeRules;
};

export const hostChangeRefusalOf = async ({
  ports,
  sessionId,
  worktreePath,
  branch,
  sha,
  changes,
}: Params): Promise<HostChangeRefusal | null> => {
  if (!isChangeGateOn({ rules: changes })) {
    return null;
  }
  try {
    const host = await ports.readHostChanges({ sessionId, worktreePath, branch, head: sha });
    const verdict = changeGateOf({ rules: changes, paths: host.paths, patch: host.patch });
    if (verdict.kind === 'clear') {
      return null;
    }
    return { message: changeRefusalOf({ verdict, stage: 'publish' }), isRetryable: false };
  } catch (error) {
    return {
      message: `${changeRefusalOf({ verdict: { kind: 'unread' }, stage: 'publish' })} (${formatError(error)})`,
      isRetryable: true,
    };
  }
};
