import { describe, expect, it } from 'vitest';
import type { GraphData } from '@/api/types';
import { canConnect, createNode, nodeKinds, placeNode } from './rules';

const graph = (nodes: GraphData['nodes'], edges: GraphData['edges'] = []): GraphData => ({
  nodes,
  edges,
  viewport: { x: 0, y: 0, zoom: 1 },
});

const prompt = createNode('prompt', { x: 0, y: 0 }, 'p1');
const generator = createNode('generator', { x: 1, y: 0 }, 'g1');
const result = createNode('result', { x: 2, y: 0 }, 'r1');

describe('createNode', () => {
  it('заполняет данные по описанию типа ноды', () => {
    expect(prompt).toMatchObject({ id: 'p1', type: 'prompt', data: { text: '' } });
    expect(generator.data).toEqual({ label: nodeKinds.generator.title });
  });
});

describe('canConnect', () => {
  const base = graph([prompt, generator, result]);

  it('разрешает цепочку текст → генератор → результат', () => {
    expect(canConnect(base, { source: 'p1', target: 'g1' }).ok).toBe(true);
    expect(canConnect(base, { source: 'g1', target: 'r1' }).ok).toBe(true);
  });

  it('запрещает несовместимые пары и обратное направление', () => {
    expect(canConnect(base, { source: 'p1', target: 'r1' }).ok).toBe(false);
    expect(canConnect(base, { source: 'g1', target: 'p1' }).ok).toBe(false);
    expect(canConnect(base, { source: 'r1', target: 'g1' }).ok).toBe(false);
  });

  it('запрещает связь ноды с собой и повтор существующей связи', () => {
    const linked = graph([prompt, generator, result], [{ id: 'e1', source: 'p1', target: 'g1' }]);

    expect(canConnect(base, { source: 'g1', target: 'g1' }).ok).toBe(false);
    expect(canConnect(linked, { source: 'p1', target: 'g1' }).ok).toBe(false);
  });

  it('оставляет у входа одну связь', () => {
    const other = createNode('prompt', { x: 0, y: 100 }, 'p2');
    const linked = graph(
      [prompt, other, generator, result],
      [{ id: 'e1', source: 'p1', target: 'g1' }],
    );

    const verdict = canConnect(linked, { source: 'p2', target: 'g1' });

    expect(verdict.ok).toBe(false);
    expect(verdict.ok ? '' : verdict.reason).toMatch(/вход/i);
  });

  it('оставляет у генератора один результат, но текст может кормить несколько генераторов', () => {
    const secondGenerator = createNode('generator', { x: 1, y: 100 }, 'g2');
    const secondResult = createNode('result', { x: 2, y: 100 }, 'r2');
    const linked = graph(
      [prompt, generator, secondGenerator, result, secondResult],
      [
        { id: 'e1', source: 'p1', target: 'g1' },
        { id: 'e2', source: 'g1', target: 'r1' },
      ],
    );

    expect(canConnect(linked, { source: 'g1', target: 'r2' }).ok).toBe(false);
    expect(canConnect(linked, { source: 'p1', target: 'g2' }).ok).toBe(true);
  });

  it('объясняет отказ, а не молчит', () => {
    const verdict = canConnect(base, { source: 'p1', target: 'r1' });

    expect(verdict.ok).toBe(false);
    expect(verdict.ok ? '' : verdict.reason).toMatch(/генератор/i);
  });
});

describe('placeNode', () => {
  it('разводит типы нод по колонкам и не наслаивает соседей', () => {
    expect(placeNode('prompt', 0).x).toBeLessThan(placeNode('generator', 0).x);
    expect(placeNode('generator', 0).x).toBeLessThan(placeNode('result', 0).x);
    expect(placeNode('prompt', 1).y).toBeGreaterThan(placeNode('prompt', 0).y);
  });
});
