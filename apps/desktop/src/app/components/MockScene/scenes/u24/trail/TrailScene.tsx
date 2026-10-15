import { Trail, type TrailSegmentModel } from '@goodboy/ui';
import {
  buildSessionBreadcrumb,
  type SessionBreadcrumbInput,
} from '../../../../../../features/session/components/SessionWorkspace/sessionBreadcrumb';

const NOOP = () => undefined;

const HANDLERS = {
  toOverview: NOOP,
  toLens: NOOP,
  toWorkflowsList: NOOP,
  toWorkflowRun: NOOP,
  toArtifactsList: NOOP,
  toParentAgent: NOOP,
  toRootAgent: NOOP,
  toPullRequestHome: NOOP,
};

const BASE: SessionBreadcrumbInput = {
  lens: null,
  focusedWorkflowName: null,
  selectedChildWorkflowName: null,
  focusedArtifactTitle: null,
  selectedChildLabel: null,
  selectedChildHome: null,
  selectedParentLabel: null,
  selectedRootLabel: null,
  selectedQuestionLabel: null,
  pullRequestModeLabel: null,
  lensLabel: (lens) => lens,
  handlers: HANDLERS,
};

type Props = {
  readonly input: Partial<SessionBreadcrumbInput>;
  readonly title: string;
};

export const TrailScene = ({ input, title }: Props) => {
  const segments: ReadonlyArray<TrailSegmentModel> = buildSessionBreadcrumb({
    ...BASE,
    ...input,
  }).map((crumb) => ({
    id: crumb.id,
    label: crumb.label,
    icon: crumb.icon,
    ...(crumb.iconClassName !== undefined && { iconClassName: crumb.iconClassName }),
    ...(crumb.onClick !== undefined && { onSelect: crumb.onClick }),
  }));
  return (
    <main className="flex min-h-screen w-full flex-col gap-4 bg-background p-6">
      <div className="flex h-9 items-center px-3">
        <Trail segments={segments} />
      </div>
      <h1 className="text-heading">{title}</h1>
    </main>
  );
};
