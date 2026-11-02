import type {
  BitbucketIntegrationBinding,
  GitlabIntegrationBinding,
  IntegrationBinding,
  ProjectId,
  SessionId,
} from '@goodboy/types';
import type { AppState } from '../../types';
import type { ReviewSourceEntry } from '../review-source/types';
import { sessionById } from '../sessions/sessionIndex';
import type { ViewerBinding } from './viewerNameOf';

type Params = {
  readonly state: Pick<AppState, 'workspaceIntegrations' | 'sessions'>;
  readonly sessionId: SessionId;
  readonly entry: Pick<ReviewSourceEntry, 'kind' | 'projectId' | 'url'> | null;
};

type BindingsParams<Binding extends IntegrationBinding> = {
  readonly bindings: ReadonlyArray<Binding>;
  readonly projectId: ProjectId | null;
};

type ValueParams = {
  readonly value: string;
};

const hostnameOf = ({ value }: ValueParams): string => {
  const withoutScheme = value.trim().split('://').pop() ?? '';
  return (withoutScheme.split('/')[0] ?? '').toLowerCase();
};

const mostSpecificOf = <Binding extends IntegrationBinding>({
  bindings,
  projectId,
}: BindingsParams<Binding>): Binding | null =>
  bindings.find((binding) => projectId !== null && binding.projectId === projectId) ??
  bindings.find((binding) => binding.projectId === null) ??
  null;

export const viewerBindingOf = ({ state, sessionId, entry }: Params): ViewerBinding | null => {
  const session = sessionById(state.sessions, sessionId);
  if (session === undefined || entry == null || entry.kind === 'github') {
    return null;
  }
  const bindings = state.workspaceIntegrations?.[session.workspaceId] ?? [];
  const projectId = entry.projectId ?? null;
  if (entry.kind === 'gitlab') {
    const host = entry.url == null ? '' : hostnameOf({ value: entry.url });
    if (host === '') {
      return null;
    }
    return mostSpecificOf({
      bindings: bindings.filter(
        (candidate): candidate is GitlabIntegrationBinding =>
          candidate.provider === 'gitlab' && hostnameOf({ value: candidate.config.host }) === host,
      ),
      projectId,
    });
  }
  return mostSpecificOf({
    bindings: bindings.filter(
      (candidate): candidate is BitbucketIntegrationBinding => candidate.provider === 'bitbucket',
    ),
    projectId,
  });
};
