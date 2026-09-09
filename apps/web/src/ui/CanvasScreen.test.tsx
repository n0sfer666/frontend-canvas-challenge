import type { ApiConfig, GenerationData, GraphData, SpaceData } from '@/api/types';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { App } from '@/app/App';
import { AppProviders } from '@/app/AppProviders';
import { installFlowEnvironment } from '@/test/flow-environment';
import { server } from '@/test/server';

const spaceId = '11111111-1111-4111-8111-111111111111';
const promptId = '22222222-2222-4222-8222-222222222222';
const generatorId = '33333333-3333-4333-8333-333333333333';
const resultId = '44444444-4444-4444-8444-444444444444';
const generationId = '55555555-5555-4555-8555-555555555555';
const etag = `"${'a'.repeat(64)}"`;

const config: ApiConfig = {
  debounceMs: 10,
  pollIntervalMs: 10,
  generationDelayMs: 10,
  maxNodes: 20,
  maxEdges: 20,
  nodeTypes: ['prompt', 'generator', 'result'],
  links: {},
};

const space: SpaceData = {
  id: spaceId,
  title: 'Рабочее пространство',
  createdAt: '2026-01-01T00:00:00.000Z',
  links: {},
};

const graph: GraphData = {
  nodes: [
    { id: promptId, type: 'prompt', position: { x: 40, y: 40 }, data: { text: 'Горы' } },
    {
      id: generatorId,
      type: 'generator',
      position: { x: 380, y: 40 },
      data: { label: 'Генератор' },
    },
    { id: resultId, type: 'result', position: { x: 720, y: 40 }, data: { label: 'Результат' } },
  ],
  edges: [
    { id: '66666666-6666-4666-8666-666666666666', source: promptId, target: generatorId },
    { id: '77777777-7777-4777-8777-777777777777', source: generatorId, target: resultId },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

const generation = (status: GenerationData['status']): GenerationData => ({
  id: generationId,
  spaceId,
  nodeId: generatorId,
  resultNodeId: resultId,
  prompt: 'Горы',
  graphETag: etag,
  scenario: status === 'failed' ? 'failure' : 'success',
  status,
  createdAt: '2026-01-01T00:00:00.000Z',
  imageUrl: status === 'succeeded' ? '/assets/demo.svg' : null,
  failureCode: status === 'failed' ? 'SIMULATED_FAILURE' : null,
  links: {},
});

const baseHandlers = (saves: GraphData[]) => [
  http.get('/api/config', () => HttpResponse.json(config)),
  http.get(`/api/spaces/${spaceId}`, () => HttpResponse.json(space)),
  http.post('/api/spaces', () => HttpResponse.json(space, { status: 201 })),
  http.get(`/api/spaces/${spaceId}/graph`, () => HttpResponse.json(graph, { headers: { ETag: etag } })),
  http.put<never, GraphData>(`/api/spaces/${spaceId}/graph`, async ({ request }) => {
    const body = await request.json();

    saves.push(body);

    return HttpResponse.json(body, { headers: { ETag: etag } });
  }),
  http.get(`/api/spaces/${spaceId}/generations`, () => HttpResponse.json([])),
];

const openCanvas = async () => {
  render(
    <AppProviders>
      <App />
    </AppProviders>,
  );

  return within(await screen.findByLabelText('Нода «Генератор»'));
};

describe('экран канваса', () => {
  beforeAll(() => {
    installFlowEnvironment();
  });

  beforeEach(() => {
    window.localStorage.setItem('canvas.space', spaceId);
  });

  it('успешная генерация показывает изображение в ноде результата', async () => {
    const user = userEvent.setup();

    server.use(
      ...baseHandlers([]),
      http.post(`/api/spaces/${spaceId}/generations`, () =>
        HttpResponse.json(generation('processing'), { status: 202 }),
      ),
      http.get(`/api/spaces/${spaceId}/generations/${generationId}`, () => HttpResponse.json(generation('succeeded'))),
    );

    const node = await openCanvas();

    await user.click(node.getByRole('button', { name: 'Сгенерировать изображение' }));

    expect(await screen.findByAltText('Результат генерации')).toHaveAttribute('src', '/assets/demo.svg');
    expect(node.getByRole('status')).toHaveTextContent('успешно');
  });

  it('тестовый отказ объясняет ситуацию и допускает новый запуск', async () => {
    const user = userEvent.setup();

    server.use(
      ...baseHandlers([]),
      http.post(`/api/spaces/${spaceId}/generations`, () =>
        HttpResponse.json(generation('processing'), { status: 202 }),
      ),
      http.get(`/api/spaces/${spaceId}/generations/${generationId}`, () => HttpResponse.json(generation('failed'))),
    );

    const node = await openCanvas();
    const start = node.getByRole('button', { name: 'Сгенерировать изображение' });

    await user.click(start);

    expect(await screen.findByText(/SIMULATED_FAILURE/)).toBeInTheDocument();
    expect(start).toBeEnabled();
  });

  it('конфликт версии графа предлагает перечитать сервер, а не повторить запись', async () => {
    const user = userEvent.setup();

    server.use(
      http.put(`/api/spaces/${spaceId}/graph`, () =>
        HttpResponse.json({ error: { code: 'GRAPH_VERSION_CONFLICT', message: 'Граф изменился' } }, { status: 412 }),
      ),
      ...baseHandlers([]),
    );

    await openCanvas();
    const field = screen.getByLabelText('Описание изображения');

    await user.type(field, ' и озеро');

    expect(await screen.findByRole('button', { name: 'Перечитать серверный граф' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Повторить сохранение' })).not.toBeInTheDocument();
    expect(field).toHaveValue('Горы и озеро');
  });

  it('правка текста уходит на сервер одним сохранением', async () => {
    const user = userEvent.setup();
    const saves: GraphData[] = [];

    server.use(...baseHandlers(saves));

    await openCanvas();
    const field = screen.getByLabelText('Описание изображения');

    await user.clear(field);
    await user.type(field, 'Море');

    const savedText = () => {
      const node = saves.at(-1)?.nodes.find((item) => item.id === promptId);

      return node?.type === 'prompt' ? node.data.text : null;
    };

    await waitFor(() => {
      expect(savedText()).toBe('Море');
    });
    expect(saves.length).toBeLessThan(5);
    expect(await screen.findByText('Все изменения сохранены')).toBeInTheDocument();
  });
});
