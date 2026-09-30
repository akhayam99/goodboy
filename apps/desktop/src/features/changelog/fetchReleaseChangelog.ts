import { invokeCommand } from '../../shared/lib/invokeCommand';

export const fetchReleaseChangelog = ({ version }: { readonly version: string }): Promise<string> =>
  invokeCommand<string>('release_changelog', { version });
