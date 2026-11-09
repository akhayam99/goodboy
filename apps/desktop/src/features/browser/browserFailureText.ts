import { toCommandError } from '../../shared/lib/invokeCommand';

type Params = {
  readonly error: unknown;
};

const WORDS: ReadonlyMap<string, string> = new Map([
  ['not-web-address', "That address can't open here."],
  ['invalid-address', "That isn't an address."],
  ['tab-gone', 'This tab closed. Open the page again.'],
  ['tab-closed', 'This tab was put to sleep. Open it again.'],
  ['window-gone', 'This window lost the tab. Open the page again.'],
  ['other-window', 'This tab is open in another window.'],
  ['session-closing', 'This session is closing.'],
  ['tab-row-gone', 'This tab is gone. Reload the session.'],
  ['tab-row-owner', 'This tab moved. Reload the session.'],
  ['tab-not-saved', "The tab didn't save. Try again."],
]);

const FALLBACK = "The page didn't respond. Try again.";

export const browserFailureText = ({ error }: Params): string =>
  WORDS.get(toCommandError(error).message) ?? FALLBACK;
