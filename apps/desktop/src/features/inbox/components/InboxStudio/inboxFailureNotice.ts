import { splitErrorMessage } from '@goodboy/ui';

type Failure = {
  readonly name: string;
  readonly message: string;
};

export type InboxFailureNotice = {
  readonly tone: 'danger' | 'warning';
  readonly title: string;
  readonly body: string | undefined;
  readonly detail: string | null;
};

type Params = {
  readonly failures: ReadonlyArray<Failure>;
};

const PERMISSION_PROBLEM =
  /\b(?:401|403)\b|token|permission|scope|unauthori[sz]ed|forbidden|denied|refused|credential/i;

const joinNames = ({ names }: { readonly names: ReadonlyArray<string> }): string => {
  const last = names[names.length - 1] ?? 'a tool';
  return names.length <= 1 ? last : `${names.slice(0, -1).join(', ')} and ${last}`;
};

export const inboxFailureNoticeOf = ({ failures }: Params): InboxFailureNotice | null => {
  const [first] = failures;
  if (first === undefined) {
    return null;
  }
  const isPermission = failures.every((failure) => PERMISSION_PROBLEM.test(failure.message));
  const tone = isPermission ? 'warning' : 'danger';
  const title = `Couldn't load ${joinNames({ names: failures.map((failure) => failure.name) })}`;
  if (failures.length > 1) {
    return {
      tone,
      title,
      body: undefined,
      detail: failures.map((failure) => `${failure.name}: ${failure.message}`).join('\n'),
    };
  }
  const { summary, detail } = splitErrorMessage({ message: first.message });
  return {
    tone,
    title,
    body: summary ?? `${first.name} answered with an error.`,
    detail,
  };
};
