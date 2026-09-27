import { useCallback, useMemo, useState } from 'react';
import type { SessionExternalTaskProvider, WorkspaceId } from '@goodboy/types';
import type { IssueCandidate } from '../../../../../../integrations/fetchIssueCandidates';
import { useWorkspaceIssueLookup } from '../../../../../../integrations/hooks/useWorkspaceIssueLookup';
import type { LookupHit } from '../../../../../../integrations/issueCode/lookupIssueByCode';
import type { LookupProvider } from '../../../../../../integrations/issueCode/routeIssueCode';
import { launchSpecFor } from '../../../../../../inbox/launchSpecFor';
import { resolvePastedIssueCandidate } from '../resolvePastedIssueCandidate';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly provider: SessionExternalTaskProvider;
};

type Result = {
  readonly onQueryChange: (query: string) => void;
  readonly resolvePaste: (rawValue: string) => IssueCandidate | null;
};

const NO_PROVIDERS: ReadonlyArray<LookupProvider> = [];

type ProviderParams = {
  readonly provider: SessionExternalTaskProvider;
};

type HitParams = {
  readonly hit: LookupHit;
};

const lookupProviderOf = ({ provider }: ProviderParams): LookupProvider | null => {
  switch (provider) {
    case 'linear':
    case 'jira':
    case 'github':
    case 'gitlab':
    case 'sentry':
      return provider;
    case 'slack':
    case 'bitbucket':
      return null;
    default: {
      const exhaustive: never = provider;
      return exhaustive;
    }
  }
};

const candidateOfHit = ({ hit }: HitParams): IssueCandidate => {
  const spec = launchSpecFor({ record: hit.record });
  return spec === null ? hit.candidate : { ...hit.candidate, ...spec.externalTask };
};

export const usePastedIssueResolver = ({ workspaceId, provider }: Params): Result => {
  const [query, setQuery] = useState('');
  const lookupProvider = lookupProviderOf({ provider });
  const providers = useMemo(
    () => (lookupProvider === null ? NO_PROVIDERS : [lookupProvider]),
    [lookupProvider],
  );
  const lookup = useWorkspaceIssueLookup({
    workspaceId,
    query: lookupProvider === null ? '' : query,
    providers,
  });
  const onQueryChange = useCallback((next: string) => setQuery(next), []);
  const resolvePaste = useCallback(
    (rawValue: string): IssueCandidate | null => {
      if (lookupProvider === null || lookup.code === null) {
        return resolvePastedIssueCandidate({ provider, rawValue });
      }
      if (lookup.settled === null) {
        return null;
      }
      const hit = lookup.settled.hits.find((entry) => entry.candidate.provider === provider);
      return hit === undefined
        ? resolvePastedIssueCandidate({ provider, rawValue })
        : candidateOfHit({ hit });
    },
    [lookup.code, lookup.settled, lookupProvider, provider],
  );
  return { onQueryChange, resolvePaste };
};
