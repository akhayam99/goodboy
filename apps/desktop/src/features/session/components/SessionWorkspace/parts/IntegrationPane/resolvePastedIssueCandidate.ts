import type { SessionExternalTaskProvider } from '@goodboy/types';
import type { IssueCandidate } from '../../../../../integrations/fetchIssueCandidates';
import { parseIntegrationTaskUrl } from './parseIntegrationTaskUrl';

type Params = {
  readonly provider: SessionExternalTaskProvider;
  readonly rawValue: string;
};

type UrlShapeParams = {
  readonly value: string;
};

const hasUrlShape = ({ value }: UrlShapeParams): boolean => {
  if (value.includes('://')) {
    return true;
  }
  const host = value.split('/')[0] ?? '';
  return value.includes('/') && host.includes('.');
};

export const resolvePastedIssueCandidate = ({
  provider,
  rawValue,
}: Params): IssueCandidate | null => {
  const trimmedValue = rawValue.trim();
  if (!hasUrlShape({ value: trimmedValue })) {
    return null;
  }
  const parsedTask = parseIntegrationTaskUrl({ provider, rawUrl: trimmedValue });
  if (parsedTask == null) {
    return null;
  }
  return {
    provider,
    externalId: parsedTask.externalId,
    identifier: parsedTask.identifier,
    title: parsedTask.title,
    url: parsedTask.url,
    goal: parsedTask.title,
    branchSlug: '',
  };
};
