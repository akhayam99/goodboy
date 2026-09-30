import { useShallow } from 'zustand/react/shallow';
import type { Project } from '@goodboy/types';
import { Tooltip } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { IntegrationGlyph } from '../components/IntegrationGlyph';

type Props = {
  readonly project: Project;
};

export const SentryLinkedBadge = ({ project }: Props) => {
  const names = useAppStore(
    useShallow((state) =>
      (state.projectSentryLinks[project.workspaceId] ?? [])
        .filter((link) => link.projectId === project.id)
        .map((link) => link.sentryProjectName ?? link.sentryProject),
    ),
  );
  if (names.length === 0) {
    return null;
  }
  const label = `Sentry: ${names.join(', ')}`;
  return (
    <Tooltip content={label}>
      <span role="img" aria-label={label} className="inline-flex shrink-0 items-center">
        <IntegrationGlyph provider="sentry" size="xs" useBrandColor />
      </span>
    </Tooltip>
  );
};
