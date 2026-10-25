import { NAMES } from '../utils/names';

type IdentifierParams = {
  readonly identifier: string;
};

export const startFromLabel = ({ identifier }: IdentifierParams): string =>
  `${NAMES.start} from ${identifier}`;

export const WRITE_REPORT_CHOICE = 'Write a report';
export const DRAW_WIREFRAME_CHOICE = 'Draw a wireframe';
