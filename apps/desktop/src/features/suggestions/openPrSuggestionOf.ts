import type { SessionId } from '@goodboy/types';
import { commitsAheadLabel } from './commitsAheadLabel';
import type { OpenPrTarget, ScribeRequestState, SessionSuggestion } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly targets: ReadonlyArray<OpenPrTarget>;
  readonly dismissedFingerprints?: ReadonlySet<string>;
};

type TargetParams = {
  readonly target: OpenPrTarget;
};

type OpenPrSuggestion = Extract<SessionSuggestion, { readonly kind: 'open-pr' }>;

const SEPARATOR = ' · ';

const SCRIBE_DETAIL = {
  writing: 'Scribe is writing the text',
  creating: 'Opening the pull request',
  ready: 'Scribe wrote the text, review it',
} as const satisfies Readonly<Record<ScribeRequestState, string>>;

const fingerprintOf = ({ target }: TargetParams): string =>
  `open-pr:${target.mountId}:${target.ahead}`;

const reasonOf = ({ target }: TargetParams): string => {
  if (target.scribe !== null) {
    return SCRIBE_DETAIL[target.scribe];
  }
  return commitsAheadLabel({ ahead: target.ahead });
};

const byRank = (first: OpenPrTarget, second: OpenPrTarget): number =>
  Number(second.scribe !== null) - Number(first.scribe !== null) ||
  second.ahead - first.ahead ||
  first.projectName.localeCompare(second.projectName) ||
  first.branch.localeCompare(second.branch);

export const openPrSuggestionOf = ({
  sessionId,
  targets,
  dismissedFingerprints,
}: Params): OpenPrSuggestion | null => {
  const ranked = targets
    .filter((target) => dismissedFingerprints?.has(fingerprintOf({ target })) !== true)
    .sort(byRank);
  const [lead] = ranked;
  if (lead === undefined) {
    return null;
  }
  return {
    id: `open-pr:${lead.mountId}`,
    kind: 'open-pr',
    priority: 42,
    band: 2,
    title: `Open a pull request for ${lead.branch}`,
    detail: `${lead.projectName}${SEPARATOR}${reasonOf({ target: lead })}`,
    sessionId,
    targetKey: `pr:${lead.mountId}`,
    fingerprint: fingerprintOf({ target: lead }),
    payload: { ...lead, targets: ranked },
  };
};
