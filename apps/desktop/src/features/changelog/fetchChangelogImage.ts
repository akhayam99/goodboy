import { invokeCommand } from '../../shared/lib/invokeCommand';

export type FetchChangelogImageParams = {
  readonly version: string;
  readonly file: string;
};

export const fetchChangelogImage = ({
  version,
  file,
}: FetchChangelogImageParams): Promise<string> =>
  invokeCommand<string>('changelog_image', { version, file });
