type RegisterParams<Port> = {
  readonly port: Port | null;
};

export type PortSlot<Port> = {
  readonly register: (params: RegisterParams<Port>) => void;
  readonly current: () => Port | null;
};

export const createPort = <Port>(): PortSlot<Port> => {
  let registered: Port | null = null;
  return {
    register: ({ port }) => {
      registered = port;
    },
    current: () => registered,
  };
};
