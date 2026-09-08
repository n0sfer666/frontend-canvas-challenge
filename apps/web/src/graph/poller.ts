type Options = { intervalMs: number };

export const createPoller = ({ intervalMs }: Options) => {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let stopped = false;

  const stop = (id: string) => {
    const timer = timers.get(id);
    if (timer !== undefined) clearTimeout(timer);
    timers.delete(id);
  };

  return {
    schedule: (id: string, task: () => void) => {
      stop(id);
      if (stopped) return;
      timers.set(id, setTimeout(task, intervalMs));
    },
    stop,
    resume: () => {
      stopped = false;
    },
    dispose: () => {
      stopped = true;
      for (const id of [...timers.keys()]) stop(id);
    },
    stopped: () => stopped,
  };
};

export type Poller = ReturnType<typeof createPoller>;
