import { autoRefusalUserReason, parseAutoDelegationRole } from '@goodboy/core';
import type { AutoPendingRefusal } from '../../../store/slices/auto-view/state';
import { AGENT_KIND_META, kindForRole } from '../../session/agent-kind';
import { joinNouns } from '../joinNouns';

type Params = {
  readonly refusal: AutoPendingRefusal;
};

type NounsParams = {
  readonly roles: ReadonlyArray<string>;
};

const nounsOf = ({ roles }: NounsParams): ReadonlyArray<string> => {
  const nouns: string[] = [];
  for (const value of roles) {
    const role = parseAutoDelegationRole({ role: value });
    if (role === null) {
      continue;
    }
    const noun = AGENT_KIND_META[kindForRole({ role })].noun;
    if (!nouns.includes(noun)) {
      nouns.push(noun);
    }
  }
  return nouns;
};

const VOWELS = ['A', 'E', 'I', 'O', 'U'];

const whatOf = ({ roles }: NounsParams): string => {
  const nouns = nounsOf({ roles });
  const only = nouns[0];
  if (nouns.length === 1 && only !== undefined) {
    return `${VOWELS.includes(only.charAt(0).toUpperCase()) ? 'an' : 'a'} ${only}`;
  }
  if (nouns.length > 1) {
    return joinNouns({ nouns });
  }
  return 'an agent';
};

export const refusalNoticeOf = ({ refusal }: Params): string => {
  const reason = autoRefusalUserReason({ code: refusal.code });
  if (refusal.action === 'answer') {
    return `Auto's answer to an agent was not sent: ${reason}. Auto is choosing again.`;
  }
  if (refusal.action === 'finish') {
    return `Auto tried to finish. Not finished: ${reason}. Auto is choosing again.`;
  }
  return `Auto tried to start ${whatOf({ roles: refusal.roles })}. Not started: ${reason}. Auto is choosing again.`;
};
