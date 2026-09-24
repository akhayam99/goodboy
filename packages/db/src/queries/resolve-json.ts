import { isStringArray, parseJsonColumn } from '../shared/parseJsonColumn';

type Params = { readonly json: string };

export const resolveStringArray = ({ json }: Params): ReadonlyArray<string> =>
  parseJsonColumn({ value: json, isValid: isStringArray, fallback: [] });
