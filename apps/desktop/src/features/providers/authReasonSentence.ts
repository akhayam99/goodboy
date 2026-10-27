import type { AuthReason } from './providers';

type Params = {
  readonly reason: AuthReason;
};

export const authReasonSentence = ({ reason }: Params): string => {
  switch (reason.kind) {
    case 'timed_out':
      return `The CLI didn't answer in ${reason.secs} s`;
    case 'not_installed':
      return "The CLI isn't installed";
    case 'spawn_failed':
      return reason.detail;
    case 'cli_said':
      return reason.detail;
    case 'printed_nothing':
      return 'The CLI printed nothing';
    case 'exited_with_code':
      return `The CLI exited with code ${reason.code}`;
    case 'no_exit_code':
      return 'The CLI ended without an exit code';
    case 'empty_command':
      return 'The check had no command to run';
    case 'no_access_token':
      return 'Cursor holds no access token';
    case 'not_confirmed_by_server':
      return "Cursor didn't confirm the account with its server";
    case 'no_status':
      return 'The CLI gave no status';
    case 'unknown_provider':
      return 'Unknown provider';
    case 'check_unfinished':
      return "The check didn't finish";
    default: {
      const unreachable: never = reason;
      return unreachable;
    }
  }
};
