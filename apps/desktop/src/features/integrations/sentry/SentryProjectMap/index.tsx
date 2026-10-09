import { useState } from 'react';
import type { IntegrationCredentialId, ProjectId, WorkspaceId } from '@goodboy/types';
import { Band, Notice, formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { ProjectLinkRow } from './ProjectLinkRow';
import { SuggestionRow } from './SuggestionRow';
import { useSentryProjectMap } from './useSentryProjectMap';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly credentialId: IntegrationCredentialId;
  readonly org: string;
};

export const SentryProjectMap = ({ workspaceId, credentialId, org }: Props) => {
  const { projects, links, sentryProjects, suggestions, error } = useSentryProjectMap({
    workspaceId,
    credentialId,
    org,
  });
  const linkSentryProject = useAppStore((state) => state.linkSentryProject);
  const unlinkSentryProject = useAppStore((state) => state.unlinkSentryProject);
  const [isBusy, setIsBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const nameOf = (slug: string): string | null =>
    sentryProjects.find((item) => item.slug === slug)?.name ?? null;

  const run = async (work: () => Promise<void>) => {
    setIsBusy(true);
    setSaveError(null);
    try {
      await work();
    } catch (workError) {
      setSaveError(formatError(workError));
    } finally {
      setIsBusy(false);
    }
  };

  const link = (projectId: ProjectId, slug: string, source: 'manual' | 'code_mapping') =>
    linkSentryProject({
      workspaceId,
      projectId,
      sentryOrg: org,
      sentryProject: slug,
      sentryProjectName: nameOf(slug),
      source,
    });

  const change = (projectId: ProjectId, slugs: ReadonlyArray<string>) =>
    run(async () => {
      const current = links.filter((item) => item.projectId === projectId);
      for (const item of current) {
        if (!slugs.includes(item.sentryProject)) {
          await unlinkSentryProject({
            workspaceId,
            projectId,
            sentryOrg: item.sentryOrg,
            sentryProject: item.sentryProject,
          });
        }
      }
      for (const slug of slugs) {
        if (!current.some((item) => item.sentryProject === slug)) {
          await link(projectId, slug, 'manual');
        }
      }
    });

  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <Band
        label="Sentry projects per project"
        ariaLabel="Sentry projects per project"
        hint="A project can read several Sentry projects, and one Sentry project can serve several projects. Without a link, Tasks uses the Sentry project you connected."
      >
        <ul aria-label="Projects and their Sentry projects" className="flex flex-col">
          {projects.map((project) => (
            <ProjectLinkRow
              key={project.id}
              project={project}
              links={links.filter((item) => item.projectId === project.id)}
              sentryProjects={sentryProjects}
              isBusy={isBusy}
              onChange={(slugs) => void change(project.id, slugs)}
            />
          ))}
        </ul>
      </Band>
      {suggestions.length > 0 ? (
        <Band
          label="Suggested from Sentry code mappings"
          ariaLabel="Suggested from Sentry code mappings"
        >
          <ul className="flex flex-col">
            {suggestions.map((suggestion) => (
              <SuggestionRow
                key={`${suggestion.projectId}:${suggestion.sentryProject}`}
                suggestion={suggestion}
                isBusy={isBusy}
                onLink={() =>
                  void run(() =>
                    link(suggestion.projectId, suggestion.sentryProject, 'code_mapping'),
                  )
                }
              />
            ))}
          </ul>
        </Band>
      ) : null}
      {error !== null || saveError !== null ? (
        <Notice
          tone="warning"
          placement="inline"
          title="Couldn't load or save the Sentry links."
          body={saveError ?? error}
        />
      ) : null}
    </div>
  );
};
