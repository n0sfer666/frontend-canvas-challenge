import { ApiError } from './errors';
import type { Http } from './http';
import type {
  ApiConfig,
  GenerationData,
  GenerationScenario,
  GraphData,
  GraphSnapshot,
  SpaceData,
} from './types';

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

export const createApi = (http: Http) => {
  const snapshot = async (request: Parameters<Http>[0]): Promise<GraphSnapshot> => {
    const response = await http<GraphData>(request);
    return { graph: required(response.data), etag: required(response.etag) };
  };

  return {
    getConfig: async (signal?: AbortSignal) =>
      required((await http<ApiConfig>({ method: 'GET', path: paths.config, signal })).data),

    listSpaces: async (signal?: AbortSignal) =>
      required((await http<SpaceData[]>({ method: 'GET', path: paths.spaces, signal })).data),

    createSpace: async (title: string, signal?: AbortSignal) =>
      required(
        (await http<SpaceData>({ method: 'POST', path: paths.spaces, body: { title }, signal }))
          .data,
      ),

    getSpace: async (spaceId: string, signal?: AbortSignal) =>
      required((await http<SpaceData>({ method: 'GET', path: paths.space(spaceId), signal })).data),

    getGraph: (spaceId: string, signal?: AbortSignal) =>
      snapshot({ method: 'GET', path: paths.graph(spaceId), signal }),

    saveGraph: ({ spaceId, graph, etag }: SaveGraphInput, signal?: AbortSignal) =>
      snapshot({
        method: 'PUT',
        path: paths.graph(spaceId),
        body: graph,
        headers: { 'If-Match': etag },
        signal,
      }),

    listGenerations: async (spaceId: string, signal?: AbortSignal) =>
      required(
        (await http<GenerationData[]>({ method: 'GET', path: paths.generations(spaceId), signal }))
          .data,
      ),

    getGeneration: async (spaceId: string, generationId: string, signal?: AbortSignal) =>
      required(
        (
          await http<GenerationData>({
            method: 'GET',
            path: paths.generation(spaceId, generationId),
            signal,
          })
        ).data,
      ),

    startGeneration: async (input: StartGenerationInput, signal?: AbortSignal) =>
      required(
        (
          await http<GenerationData>({
            method: 'POST',
            path: paths.generations(input.spaceId),
            body: {
              nodeId: input.nodeId,
              graphETag: input.graphETag,
              scenario: input.scenario,
            },
            headers: { 'Idempotency-Key': input.idempotencyKey },
            signal,
          })
        ).data,
      ),
  };
};

export type Api = ReturnType<typeof createApi>;
