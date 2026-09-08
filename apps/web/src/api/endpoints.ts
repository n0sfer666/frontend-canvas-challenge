import { ApiError } from './errors';
import type { Http, HttpRequest } from './http';
import { joinUrl } from './http';
import {
  ConfigSchema,
  GenerationListSchema,
  GenerationSchema,
  GraphSchema,
  SpaceListSchema,
  SpaceSchema,
} from './schemas';
import type { GenerationScenario, GraphData, GraphSnapshot } from './types';

const paths = {
  config: '/api/config',
  spaces: '/api/spaces',
  space: (spaceId: string) => `/api/spaces/${spaceId}`,
  graph: (spaceId: string) => `/api/spaces/${spaceId}/graph`,
  generations: (spaceId: string) => `/api/spaces/${spaceId}/generations`,
  generation: (spaceId: string, generationId: string) =>
    `/api/spaces/${spaceId}/generations/${generationId}`,
};

const required = <T>(value: T | null | undefined): T => {
  if (value === null || value === undefined)
    throw new ApiError({ status: 0, code: 'EMPTY_RESPONSE' });
  return value;
};

export type StartGenerationInput = {
  spaceId: string;
  nodeId: string;
  graphETag: string;
  scenario: GenerationScenario;
  idempotencyKey: string;
};

export type SaveGraphInput = { spaceId: string; graph: GraphData; etag: string };

export const createApi = (http: Http, baseUrl = '') => {
  const snapshot = async (request: HttpRequest<GraphData>): Promise<GraphSnapshot> => {
    const response = await http(request);
    return { graph: required(response.data), etag: required(response.etag) };
  };

  return {
    assetUrl: (path: string) => joinUrl(baseUrl, path),

    getConfig: async (signal?: AbortSignal) =>
      required(
        (await http({ method: 'GET', path: paths.config, schema: ConfigSchema, signal })).data,
      ),

    listSpaces: async (signal?: AbortSignal) =>
      required(
        (await http({ method: 'GET', path: paths.spaces, schema: SpaceListSchema, signal })).data,
      ),

    createSpace: async (title: string, signal?: AbortSignal) =>
      required(
        (
          await http({
            method: 'POST',
            path: paths.spaces,
            body: { title },
            schema: SpaceSchema,
            signal,
          })
        ).data,
      ),

    getSpace: async (spaceId: string, signal?: AbortSignal) =>
      required(
        (await http({ method: 'GET', path: paths.space(spaceId), schema: SpaceSchema, signal })).data,
      ),

    getGraph: (spaceId: string, signal?: AbortSignal) =>
      snapshot({ method: 'GET', path: paths.graph(spaceId), schema: GraphSchema, signal }),

    saveGraph: ({ spaceId, graph, etag }: SaveGraphInput, signal?: AbortSignal) =>
      snapshot({
        method: 'PUT',
        path: paths.graph(spaceId),
        body: graph,
        schema: GraphSchema,
        headers: { 'If-Match': etag },
        signal,
      }),

    listGenerations: async (spaceId: string, signal?: AbortSignal) =>
      required(
        (
          await http({
            method: 'GET',
            path: paths.generations(spaceId),
            schema: GenerationListSchema,
            signal,
          })
        ).data,
      ),

    getGeneration: async (spaceId: string, generationId: string, signal?: AbortSignal) =>
      required(
        (
          await http({
            method: 'GET',
            path: paths.generation(spaceId, generationId),
            schema: GenerationSchema,
            signal,
          })
        ).data,
      ),

    startGeneration: async (input: StartGenerationInput, signal?: AbortSignal) =>
      required(
        (
          await http({
            method: 'POST',
            path: paths.generations(input.spaceId),
            body: {
              nodeId: input.nodeId,
              graphETag: input.graphETag,
              scenario: input.scenario,
            },
            schema: GenerationSchema,
            headers: { 'Idempotency-Key': input.idempotencyKey },
            signal,
          })
        ).data,
      ),
  };
};

export type Api = ReturnType<typeof createApi>;
