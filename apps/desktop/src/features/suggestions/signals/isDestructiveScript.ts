type Params = {
  readonly name: string;
};

const DESTRUCTIVE_NAME = /(?:^|[:_-])(?:migrate|seed|deploy|clean|reset|drop|push)(?:$|[:_-])/i;

export const isDestructiveScript = ({ name }: Params): boolean => DESTRUCTIVE_NAME.test(name);
