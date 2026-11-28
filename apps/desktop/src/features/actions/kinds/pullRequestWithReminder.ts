import { Clock } from '@goodboy/ui/icons';
import { PULL_REQUEST_NOUNS } from '@goodboy/core/review-source';
import { isWaitingForGreen } from '../../calendar/reminders/isWaitingForGreen';
import { remindWhenGreen } from '../../calendar/reminders/remindWhenGreen';
import type { ActionDefinition, ObjectKindDefinition, PullRequestActionTarget } from '../types';
import { PULL_REQUEST_KIND } from './pullRequest';
import type { PullRequestFacts } from './pullRequestFacts';

type FactsParams = {
  readonly facts: PullRequestFacts;
};

const numberLabelOf = ({ facts }: FactsParams): string =>
  `${PULL_REQUEST_NOUNS[facts.host].numberPrefix}${facts.number ?? ''}`;

const REMIND_WHEN_GREEN: ActionDefinition<PullRequestFacts> = {
  id: 'pullRequest.remindWhenGreen',
  label: 'Remind me when CI is green',
  icon: Clock,
  group: 'act',
  when: ({ facts }) =>
    facts.phase === 'open' &&
    facts.checks === 'pending' &&
    facts.number !== null &&
    facts.isRemindedWhenGreen === false,
  slot: () => 'menu',
  doneLabel: ({ facts }) => `Needs you shows ${numberLabelOf({ facts })} when its checks pass.`,
  run: ({ facts, env }) =>
    facts.number === null
      ? 'unchanged'
      : remindWhenGreen({
          state: env.getState(),
          sessionId: facts.sessionId,
          mountId: facts.mountId,
          prNumber: facts.number,
          numberLabel: numberLabelOf({ facts }),
        }),
};

export const PULL_REQUEST_WITH_REMINDER_KIND: ObjectKindDefinition<
  PullRequestActionTarget,
  PullRequestFacts
> = {
  ...PULL_REQUEST_KIND,
  facts: ({ state, target }) => {
    const facts = PULL_REQUEST_KIND.facts({ state, target });
    if (facts === null || facts.number === null) {
      return facts;
    }
    return {
      ...facts,
      isRemindedWhenGreen: isWaitingForGreen({
        reminders: state.calendarReminders,
        sessionId: facts.sessionId,
        mountId: facts.mountId,
        prNumber: facts.number,
      }),
    };
  },
  actions: [...PULL_REQUEST_KIND.actions, REMIND_WHEN_GREEN],
};
