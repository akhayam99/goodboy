import { countNoun } from './countNoun';

export const pluralize = (count: number, singular: string) => countNoun({ count, one: singular });
