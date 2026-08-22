export const SLACK_USER_SCOPES: ReadonlyArray<string> = [
  'channels:read',
  'channels:history',
  'users:read',
  'chat:write',
  'reactions:write',
];

export const SLACK_APPS_URL = 'https://api.slack.com/apps';

export const SLACK_NEW_APP_URL = 'https://api.slack.com/apps/new';

export const SLACK_MANIFEST_URL_LIMIT = 8000;

const MANIFEST_MAJOR_VERSION = 2;

const MANIFEST_MINOR_VERSION = 1;

type SlackAppManifest = {
  readonly _metadata: {
    readonly major_version: number;
    readonly minor_version: number;
  };
  readonly display_information: {
    readonly name: string;
    readonly description: string;
  };
  readonly oauth_config: {
    readonly scopes: {
      readonly user: ReadonlyArray<string>;
    };
  };
  readonly settings: {
    readonly org_deploy_enabled: boolean;
    readonly socket_mode_enabled: boolean;
    readonly token_rotation_enabled: boolean;
  };
};

type ManifestParams = {
  readonly userScopes: ReadonlyArray<string>;
};

const buildSlackAppManifest = ({ userScopes }: ManifestParams): SlackAppManifest => ({
  _metadata: {
    major_version: MANIFEST_MAJOR_VERSION,
    minor_version: MANIFEST_MINOR_VERSION,
  },
  display_information: {
    name: 'Goodboy',
    description: 'Reads the Slack threads your tasks come out of.',
  },
  oauth_config: {
    scopes: {
      user: [...userScopes],
    },
  },
  settings: {
    org_deploy_enabled: false,
    socket_mode_enabled: false,
    token_rotation_enabled: false,
  },
});

export const buildSlackManifestUrl = ({ userScopes }: ManifestParams): string | null => {
  const manifest = buildSlackAppManifest({ userScopes });
  const url = `${SLACK_APPS_URL}?new_app=1&manifest_json=${encodeURIComponent(JSON.stringify(manifest))}`;
  return url.length > SLACK_MANIFEST_URL_LIMIT ? null : url;
};
