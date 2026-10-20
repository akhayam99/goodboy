import { AUTO_WRITER_ROLES, isAutoWriterRole, type AutoDelegationRole } from './roles';

const COMMAND_TOOL_RE =
  /\b(?:git|gh|npm|pnpm|yarn|cargo|make|docker|kubectl|curl)[ \t]+[a-z][a-z-]*/i;
const RUN_COMMAND_RE =
  /\b(?:run|execute|invoke)\b[^.\n]{0,40}\b(?:commands?|scripts?|tests?|build|lint|typecheck)\b/i;
const LS_REMOTE_RE = /\bls-remote\b/i;

const MISSING_SHELL_RE =
  /\bno (?:shell|bash|terminal)\b|\b(?:shell|bash|terminal) tool\b|\bcannot run (?:commands?|shell)\b|\b(?:did not|didn't|does not|doesn't|do not|don't) have (?:a )?(?:shell|bash)\b/i;

type RoleParams = {
  readonly role: AutoDelegationRole;
};

type TextParams = {
  readonly text: string;
};

export const canAutoRoleRunCommands = ({ role }: RoleParams): boolean => isAutoWriterRole({ role });

export const AUTO_COMMAND_ROLES: ReadonlyArray<AutoDelegationRole> = AUTO_WRITER_ROLES;

export const doesTaskNeedCommands = ({ text }: TextParams): boolean =>
  COMMAND_TOOL_RE.test(text) || RUN_COMMAND_RE.test(text) || LS_REMOTE_RE.test(text);

export const isMissingShellText = ({ text }: TextParams): boolean => MISSING_SHELL_RE.test(text);

export const roleCannotRunCommandsMessage = ({ role }: RoleParams): string =>
  `${role} has no shell, so it cannot run commands such as git or tests. A task that runs commands goes to a role that can: ${AUTO_COMMAND_ROLES.join(', ')}. Say in the task that the check is read only. A task that only reads files can stay with ${role}: write it without command lines. Commits, pull request, review thread and check facts of a branch are not commands: a scout with "facts" naming the mounts gets them read by Goodboy.`;

export const rerouteHintOf = ({ role }: RoleParams): string =>
  `  it had no shell tool, so the work did not run. This is not the answer for the user: hand the same task once to a role that can run commands (${AUTO_COMMAND_ROLES.filter((candidate) => candidate !== role).join(', ')}), and say the check is read only. Pull request and branch facts go to a scout whose "facts" names the mounts, not to a writer.`;
