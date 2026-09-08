export const cx = (...classes: readonly (string | undefined)[]) =>
  classes.filter((value): value is string => value !== undefined).join(' ');
