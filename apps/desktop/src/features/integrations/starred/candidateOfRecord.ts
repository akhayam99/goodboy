import type { InboxRecord } from '../../inbox/types';
import type { IssueCandidate } from '../fetchIssueCandidates';
import {
  githubIssueCandidate,
  gitlabIssueCandidate,
  jiraIssueCandidate,
  linearIssueCandidate,
  sentryIssueCandidate,
} from '../issueCandidateOf';

export const candidateOfRecord = (record: InboxRecord): IssueCandidate | null => {
  const { payload } = record;
  switch (payload.provider) {
    case 'linear':
      return linearIssueCandidate(payload.issue);
    case 'github':
      return payload.kind === 'issue' ? githubIssueCandidate(payload.issue) : null;
    case 'gitlab':
      return payload.kind === 'issue' ? gitlabIssueCandidate(payload.issue) : null;
    case 'jira':
      return jiraIssueCandidate(payload.issue);
    case 'sentry':
      return sentryIssueCandidate(payload.issue);
    case 'slack':
    case 'bitbucket':
      return null;
  }
};
