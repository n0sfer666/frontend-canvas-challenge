import { Config, Generation, Graph, Space } from '@canvas/contracts';
import { Type } from '@sinclair/typebox';
import { registerFormats } from './formats';

registerFormats();

const nullableString = Type.Union([Type.String(), Type.Null()]);

export const ConfigSchema = Config;
export const GraphSchema = Graph;
export const SpaceSchema = Space;
export const SpaceListSchema = Type.Array(Space);

export const GenerationSchema = Type.Object({
  ...Generation.properties,
  imageUrl: nullableString,
  failureCode: nullableString,
});

export const GenerationListSchema = Type.Array(GenerationSchema);
