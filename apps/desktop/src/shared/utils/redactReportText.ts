import { redactSecrets } from './redactSecrets';

export const REDACTED_EMAIL = '[email]';

const URL_USERINFO = /\b(https?:\/\/)[^/\s@"'<>]+@/gi;

const URL_QUERY_OR_FRAGMENT = /\b(https?:\/\/[^\s?#"'<>`)]+)[?#][^\s"'<>`)]*/gi;

const HOME_PREFIX = /(?:\/Users|\/home|[A-Za-z]:\\Users)[\\/][^\\/\s'"`)]+/g;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

type RedactReportTextParams = {
  readonly text: string;
};

export const collapseHomePaths = ({ text }: RedactReportTextParams): string =>
  text.replace(HOME_PREFIX, '~');

export const redactReportText = ({ text }: RedactReportTextParams): string => {
  const withoutUrlSecrets = text.replace(URL_USERINFO, '$1').replace(URL_QUERY_OR_FRAGMENT, '$1');
  const withoutSecrets = redactSecrets({ text: withoutUrlSecrets });
  return collapseHomePaths({ text: withoutSecrets }).replace(EMAIL, REDACTED_EMAIL);
};
