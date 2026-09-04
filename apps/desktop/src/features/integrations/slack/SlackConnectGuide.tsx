import { useState } from 'react';
import { Button, CopyButton, SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import { openUrl } from '../../../shared/lib/editor';
import { SLACK_APPS_URL, SLACK_NEW_APP_URL, SLACK_USER_SCOPES } from './slackAppManifest';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';

type Props = {
  readonly manifestUrl: string | null;
};

type SetupPath = 'new' | 'existing';

type GuideStep = {
  readonly title: string;
  readonly action: {
    readonly label: string;
    readonly url: string;
  } | null;
  readonly showsScopes: boolean;
};

const PATH_OPTIONS: ReadonlyArray<SegmentedTabOption<SetupPath>> = [
  { value: 'new', label: 'New app' },
  { value: 'existing', label: 'Existing app' },
];

const INSTALL_STEP: GuideStep = {
  title: 'Install the app in your workspace and allow what Slack shows you.',
  action: null,
  showsScopes: false,
};

const TOKEN_STEP: GuideStep = {
  title:
    'Copy the User OAuth Token, under OAuth and Permissions in the User column, then paste it below.',
  action: null,
  showsScopes: false,
};

const SCOPE_STEP: GuideStep = {
  title: 'Under OAuth and Permissions, add these five User Token Scopes.',
  action: null,
  showsScopes: true,
};

type StepParams = {
  readonly path: SetupPath;
  readonly manifestUrl: string | null;
};

const buildSteps = ({ path, manifestUrl }: StepParams): ReadonlyArray<GuideStep> => {
  if (path === 'existing') {
    return [
      {
        title: 'Open the app you already have.',
        action: { label: 'Open your Slack apps', url: SLACK_APPS_URL },
        showsScopes: false,
      },
      SCOPE_STEP,
      {
        title: 'Reinstall the app so the new scopes take effect.',
        action: null,
        showsScopes: false,
      },
      TOKEN_STEP,
    ];
  }

  if (manifestUrl == null) {
    return [
      {
        title: 'Create an app from scratch, named Goodboy, in your workspace.',
        action: { label: 'Open Slack app creation', url: SLACK_NEW_APP_URL },
        showsScopes: false,
      },
      SCOPE_STEP,
      INSTALL_STEP,
      TOKEN_STEP,
    ];
  }

  return [
    {
      title: 'Create the app in Slack, name and scopes already filled in.',
      action: { label: 'Open Slack with the scopes filled in', url: manifestUrl },
      showsScopes: false,
    },
    INSTALL_STEP,
    TOKEN_STEP,
  ];
};

export const SlackConnectGuide = ({ manifestUrl }: Props) => {
  const [path, setPath] = useState<SetupPath>('new');
  const [stepIndex, setStepIndex] = useState(0);
  const steps = buildSteps({ path, manifestUrl });
  const step = steps[Math.min(stepIndex, steps.length - 1)] as GuideStep;
  const isLast = stepIndex >= steps.length - 1;

  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border-soft bg-subtle/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-2xs font-medium tabular-nums text-muted-foreground">
          Step {Math.min(stepIndex, steps.length - 1) + 1} of {steps.length}
        </span>
        <SegmentedTabs
          size="sm"
          options={PATH_OPTIONS}
          value={path}
          onChange={(next) => {
            setPath(next);
            setStepIndex(0);
          }}
          ariaLabel="Slack setup path"
        />
      </div>
      <p className="min-w-0 text-xs leading-snug text-foreground">{step.title}</p>
      {step.action != null ? (
        <div className="flex">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void openUrl(step.action?.url ?? '')}
            className="max-w-full"
          >
            <span className="truncate">{step.action.label}</span>
            <ExternalLink size={11} aria-hidden />
          </Button>
        </div>
      ) : null}
      {step.showsScopes ? (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {SLACK_USER_SCOPES.map((scope) => (
            <span
              key={scope}
              className="rounded-full border border-border-soft px-2 py-0.5 font-mono text-2xs text-foreground"
            >
              {scope}
            </span>
          ))}
          <CopyButton
            value={SLACK_USER_SCOPES.join('\n')}
            label="Slack scopes"
            presentation="icon"
            size={ICON_SIZE.row}
          />
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((index) => Math.max(index - 1, 0))}
        >
          <ArrowLeft size={11} aria-hidden />
          Back
        </Button>
        {isLast ? null : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setStepIndex((index) => Math.min(index + 1, steps.length - 1))}
          >
            Next
            <ArrowRight size={11} aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
};
