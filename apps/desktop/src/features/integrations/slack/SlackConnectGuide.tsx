import { useState } from 'react';
import {
  Button,
  CopyButton,
  Divider,
  Eyebrow,
  SegmentedTabs,
  type SegmentedTabOption,
} from '@goodboy/ui';
import { ExternalLink } from 'lucide-react';
import { openUrl } from '../../../shared/lib/editor';
import { SLACK_APPS_URL, SLACK_NEW_APP_URL, SLACK_USER_SCOPES } from './slackAppManifest';

type Props = {
  readonly manifestUrl: string | null;
};

type SetupPath = 'new' | 'existing';

type GuideStep = {
  readonly title: string;
  readonly body: string;
  readonly action: {
    readonly label: string;
    readonly url: string;
  } | null;
};

const PATH_OPTIONS: ReadonlyArray<SegmentedTabOption<SetupPath>> = [
  { value: 'new', label: 'New app' },
  { value: 'existing', label: 'Existing app' },
];

const INSTALL_STEP: GuideStep = {
  title: 'Install it in your workspace',
  body: 'Slack shows what Goodboy will be able to do, then asks you to allow it.',
  action: null,
};

const TOKEN_STEP: GuideStep = {
  title: 'Copy the User OAuth Token',
  body: 'It sits under OAuth and Permissions, in the User column, and starts with xoxp-.',
  action: null,
};

const SCOPE_STEP: GuideStep = {
  title: 'Add the scopes below under User Token Scopes',
  body: 'Open OAuth and Permissions and leave Bot Token Scopes as they are.',
  action: null,
};

type StepParams = {
  readonly path: SetupPath;
  readonly manifestUrl: string | null;
};

const buildSteps = ({ path, manifestUrl }: StepParams): ReadonlyArray<GuideStep> => {
  if (path === 'existing') {
    return [
      {
        title: 'Open the app you already have',
        body: 'Pick it from your Slack apps, then open OAuth and Permissions.',
        action: { label: 'Open your Slack apps', url: SLACK_APPS_URL },
      },
      SCOPE_STEP,
      {
        title: 'Reinstall the app',
        body: 'Slack asks for it after a scope change, so the new scopes take effect.',
        action: null,
      },
      TOKEN_STEP,
    ];
  }

  if (manifestUrl == null) {
    return [
      {
        title: 'Create an app from scratch',
        body: 'Name it Goodboy and pick the workspace whose threads you read.',
        action: { label: 'Open Slack app creation', url: SLACK_NEW_APP_URL },
      },
      SCOPE_STEP,
      INSTALL_STEP,
      TOKEN_STEP,
    ];
  }

  return [
    {
      title: 'Create the app in Slack',
      body: 'Slack opens with the name and the five user scopes already filled in.',
      action: { label: 'Open Slack with the scopes filled in', url: manifestUrl },
    },
    INSTALL_STEP,
    TOKEN_STEP,
  ];
};

export const SlackConnectGuide = ({ manifestUrl }: Props) => {
  const [path, setPath] = useState<SetupPath>('new');
  const steps = buildSteps({ path, manifestUrl });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-subtle/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow label="Set up" />
        <SegmentedTabs
          size="sm"
          options={PATH_OPTIONS}
          value={path}
          onChange={setPath}
          ariaLabel="Slack setup path"
        />
      </div>

      <ol className="flex flex-col gap-2.5">
        {steps.map((step, index) => {
          const { action } = step;
          return (
            <li
              key={step.title}
              className="grid grid-cols-[1.125rem_minmax(0,1fr)] gap-x-2 gap-y-1"
            >
              <span className="pt-px text-2xs font-semibold tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-xs font-semibold leading-snug text-foreground">
                  {step.title}
                </span>
                <p className="text-2xs leading-relaxed text-muted-foreground">{step.body}</p>
                {action != null ? (
                  <div className="flex">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void openUrl(action.url)}
                      className="max-w-full"
                    >
                      <span className="truncate">{action.label}</span>
                      <ExternalLink size={11} aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <Divider />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 text-2xs leading-relaxed text-muted-foreground">
            The user token starts with <span className="font-mono">xoxp-</span> and needs these
            scopes, granted under User Token Scopes and not Bot Token Scopes:
          </p>
          <CopyButton
            value={SLACK_USER_SCOPES.join('\n')}
            label="Slack scopes"
            presentation="icon"
            size={12}
          />
        </div>
        <ul className="flex flex-wrap gap-2">
          {SLACK_USER_SCOPES.map((scope) => (
            <li
              key={scope}
              className="rounded-full border border-border-soft px-2 py-0.5 font-mono text-2xs text-foreground"
            >
              {scope}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
