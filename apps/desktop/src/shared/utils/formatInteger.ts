import { APP_LOCALE } from './appLocale';

export const formatInteger = (value: number): string => value.toLocaleString(APP_LOCALE);
