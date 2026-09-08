import type { ApiConfig, GenerationData, GraphData, SpaceData } from '@/api/types';

export const ids = {
  space: '11111111-1111-4111-8111-111111111111',
  prompt: '22222222-2222-4222-8222-222222222222',
  generator: '33333333-3333-4333-8333-333333333333',
  result: '44444444-4444-4444-8444-444444444444',
  generation: '55555555-5555-4555-8555-555555555555',
};

export const graphFixture = (patch: Partial<GraphData> = {}): GraphData => ({
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  ...patch,
});

export const spaceFixture = (patch: Partial<SpaceData> = {}): SpaceData => ({
  id: ids.space,
  title: 'Мой канвас',
  createdAt: '2026-01-01T00:00:00.000Z',
  links: {},
  ...patch,
});

export const generationFixture = (patch: Partial<GenerationData> = {}): GenerationData => ({
  id: ids.generation,
  spaceId: ids.space,
  nodeId: ids.generator,
  resultNodeId: ids.result,
  prompt: 'горы',
  graphETag: '"v2"',
  scenario: 'success',
  status: 'succeeded',
  createdAt: '2026-01-01T00:00:00.000Z',
  imageUrl: '/assets/demo.svg',
  failureCode: null,
  links: {},
  ...patch,
});

export const configFixture = (patch: Partial<ApiConfig> = {}): ApiConfig => ({
  debounceMs: 300,
  pollIntervalMs: 500,
  generationDelayMs: 0,
  maxNodes: 20,
  maxEdges: 20,
  nodeTypes: ['prompt', 'generator', 'result'],
  links: {},
  ...patch,
});
