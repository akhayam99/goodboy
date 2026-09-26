import type { Project, ProjectSentryLink } from '@goodboy/types';
import { BAND_ROW_CLASS, Listbox, cn } from '@goodboy/ui';
import type { SentryProjectSummary } from '../client';

type Props = {
  readonly project: Project;
  readonly links: ReadonlyArray<ProjectSentryLink>;
  readonly sentryProjects: ReadonlyArray<SentryProjectSummary>;
  readonly isBusy: boolean;
  readonly onChange: (slugs: ReadonlyArray<string>) => void;
};

export const ProjectLinkRow = ({ project, links, sentryProjects, isBusy, onChange }: Props) => {
  const linked = links.map((link) => link.sentryProject);
  const known = new Set(sentryProjects.map((item) => item.slug));
  const options = [
    ...sentryProjects.map((item) => ({
      value: item.slug,
      label: item.name,
      ...(item.platform === null ? {} : { meta: item.platform }),
    })),
    ...linked.filter((slug) => !known.has(slug)).map((slug) => ({ value: slug, label: slug })),
  ];
  return (
    <li className={cn(BAND_ROW_CLASS, 'gap-3 text-label')}>
      <span className="w-40 shrink-0 truncate text-foreground">{project.name}</span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">
        {linked.length === 0 ? 'No Sentry project' : linked.join(', ')}
      </span>
      <Listbox
        multiple
        size="sm"
        align="end"
        ariaLabel={`Sentry projects for ${project.name}`}
        placeholder="Link"
        searchable
        noun="Sentry project"
        disabled={isBusy || options.length === 0}
        value={linked}
        options={options}
        onChange={onChange}
      />
    </li>
  );
};
