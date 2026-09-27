import { getVersion } from '@tauri-apps/api/app';
import { cleanCliVersion } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { redactReport } from '../../../shared/utils/redactReport';
import { captureLocation } from '../../../store/slices/navigation/captureLocation';
import { locationKey } from '../../../store/slices/navigation/locationKey';
import type { AppState } from '../../../store/types';
import { CLI_LABEL } from '../../providers/cliLabel';
import { readAppPlatform, systemLabel, type AppPlatform } from './appPlatform';
import { screenLabel } from './screenLabel';

export type ReportContext = {
  readonly version: string;
  readonly build: string;
  readonly system: string;
  readonly screen: string;
  readonly cliVersions: string;
};

const UNKNOWN = 'unknown';

const NO_CLI = 'none detected';

type ReportProvider = {
  readonly id: ProviderId;
  readonly version: string | null;
};

type CliVersionsParams = {
  readonly providers: ReadonlyArray<ReportProvider>;
};

const cliVersionsLabel = ({ providers }: CliVersionsParams): string => {
  const entries = providers.flatMap((provider) => {
    const version = cleanCliVersion({ raw: provider.version });
    return version === null ? [] : [`${CLI_LABEL[provider.id]} ${version}`];
  });
  const unique = [...new Set(entries)];
  return unique.length === 0 ? NO_CLI : unique.join(', ');
};

export type ReportContextSources = {
  readonly version: string | null;
  readonly platform: AppPlatform | null;
  readonly locationKey: string;
  readonly providers: ReadonlyArray<ReportProvider>;
};

const clean = (text: string): string => redactReport({ text });

export const buildReportContext = ({
  version,
  platform,
  locationKey: key,
  providers,
}: ReportContextSources): ReportContext => ({
  version: clean(version === null || version === '' ? UNKNOWN : version),
  build: clean(platform?.buildSha ?? 'dev'),
  system: clean(systemLabel({ platform })),
  screen: clean(screenLabel({ locationKey: key })),
  cliVersions: clean(cliVersionsLabel({ providers })),
});

const readVersion = async (): Promise<string | null> => {
  try {
    return await getVersion();
  } catch {
    return null;
  }
};

type CollectParams = {
  readonly state: AppState;
};

export const collectReportContext = async ({ state }: CollectParams): Promise<ReportContext> => {
  const [version, platform] = await Promise.all([readVersion(), readAppPlatform()]);
  const location = captureLocation({ state });
  return buildReportContext({
    version,
    platform,
    locationKey: locationKey({ place: location.place, studio: location.studio }),
    providers: state.providers,
  });
};
