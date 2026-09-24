type RedactHomePathParams = {
  readonly text: string;
};

const HOME_PREFIX = /(?:\/Users|\/home|[A-Za-z]:\\Users)[\\/][^\\/\s'"`]+/g;

export const redactHomePath = ({ text }: RedactHomePathParams): string =>
  text.replace(HOME_PREFIX, '~');
