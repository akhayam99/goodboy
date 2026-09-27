import { REDACTED, redactSecrets } from './redactSecrets';

export const REDACTED_EMAIL = '[email]';

const REPORT_SECRET_LABEL = String.raw`(authorization|bearer|api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|passwd|secret)`;

const REPORT_SECRET_VALUE = String.raw`(?:(?:bearer|basic|token)\s+)?(?:"[^"\n]*"|'[^'\n]*'|[^\s"',;&]+)`;

const REPORT_LABELLED_SECRET = new RegExp(
  String.raw`\b${REPORT_SECRET_LABEL}(\s*[:=]\s*)${REPORT_SECRET_VALUE}`,
  'gi',
);

const REPORT_BEARER_VALUE = /\b(bearer)(\s+)[^\s"',;&]+/gi;

const redactShortSecrets = (text: string): string =>
  text
    .replace(
      REPORT_LABELLED_SECRET,
      (_match, label: string, separator: string) => `${label}${separator}${REDACTED}`,
    )
    .replace(
      REPORT_BEARER_VALUE,
      (_match, label: string, separator: string) => `${label}${separator}${REDACTED}`,
    );

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
  const withoutSecrets = redactSecrets({ text: redactShortSecrets(withoutUrlSecrets) });
  return collapseHomePaths({ text: withoutSecrets }).replace(EMAIL, REDACTED_EMAIL);
};
