import type { CliUpdateResult } from './cliUpdateResult';

export const stillOutdatedTitle = ({
  cli,
  version,
}: {
  readonly cli: string;
  readonly version: string;
}): string => `${cli} is still ${version}`;

export const stillOutdatedBody = ({
  cli,
  result,
  command,
}: {
  readonly cli: string;
  readonly result: CliUpdateResult;
  readonly command: string | null;
}): string => {
  const onPath =
    result.binaryPath === null
      ? `The ${cli} on your PATH did not change.`
      : `The ${cli} on your PATH is ${result.binaryPath}.`;
  const hint =
    command === null
      ? 'Update that install yourself.'
      : `Update that install, or run ${command} in your own terminal.`;
  return `The update ran, but nothing changed. ${onPath} ${hint}`;
};
