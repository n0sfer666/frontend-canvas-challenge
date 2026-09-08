import { FormatRegistry } from '@sinclair/typebox';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const checks: Record<string, (value: string) => boolean> = {
  uuid: (value) => uuid.test(value),
  'date-time': (value) => !Number.isNaN(Date.parse(value)),
};

export const registerFormats = () => {
  for (const [name, check] of Object.entries(checks)) FormatRegistry.Set(name, check);
};
