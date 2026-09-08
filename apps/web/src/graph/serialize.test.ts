import { describe, expect, it } from 'vitest';
import type { GraphData } from '@/api/types';
import { createNode, nodeKinds } from './rules';
import type { FlowNode } from './serialize';
import { sameGraph, toFlow, toGraph } from './serialize';

const promptNode = createNode('prompt', { x: 0, y: 0 }, 'p1');
const generatorNode = createNode('generator', { x: 240, y: 0 }, 'g1');

const graph: GraphData = {
  nodes: [promptNode, generatorNode],
  edges: [{ id: 'e1', source: 'p1', target: 'g1' }],
  viewport: { x: 10, y: 20, zoom: 1.5 },
};

const flowPrompt: FlowNode = {
  id: 'p1',
  type: 'prompt',
  position: { x: 0, y: 0 },
  data: { text: '' },
};
const flowGenerator: FlowNode = {
  id: 'g1',
  type: 'generator',
  position: { x: 240, y: 0 },
  data: { label: nodeKinds.generator.title },
};

describe('toFlow', () => {
  it('переносит тип, позицию и данные ноды в модель канваса', () => {
    const flow = toFlow(graph);

    expect(flow.nodes[0]).toEqual(flowPrompt);
    expect(flow.edges[0]).toEqual({ id: 'e1', source: 'p1', target: 'g1' });
    expect(flow.viewport).toEqual({ x: 10, y: 20, zoom: 1.5 });
  });
});

describe('toGraph', () => {
  it('отбрасывает служебные поля канваса и округляет координаты', () => {
    const saved = toGraph({
      nodes: [
        { ...flowPrompt, position: { x: 12.4, y: -3.7 }, selected: true, dragging: true },
        { ...flowGenerator, measured: { width: 200, height: 90 }, width: 200, height: 90 },
      ],
      edges: [{ id: 'e1', source: 'p1', target: 'g1', selected: true }],
      viewport: graph.viewport,
    });

    expect(saved.nodes[0]).toEqual({
      id: 'p1',
      type: 'prompt',
      position: { x: 12, y: -4 },
      data: { text: '' },
    });
    expect(saved.edges[0]).toEqual({ id: 'e1', source: 'p1', target: 'g1' });
  });

  it('не сохраняет связи с исчезнувшими нодами', () => {
    const saved = toGraph({
      nodes: [flowPrompt],
      edges: [{ id: 'e1', source: 'p1', target: 'g1' }],
      viewport: graph.viewport,
    });

    expect(saved.edges).toEqual([]);
  });

  it('возвращает исходный граф после полного круга', () => {
    expect(toGraph(toFlow(graph))).toEqual(graph);
  });
});

describe('sameGraph', () => {
  it('различает содержательное изменение и его отсутствие', () => {
    expect(sameGraph(graph, toGraph(toFlow(graph)))).toBe(true);
    expect(sameGraph(graph, { ...graph, viewport: { x: 0, y: 0, zoom: 1 } })).toBe(false);
    expect(
      sameGraph(graph, {
        ...graph,
        nodes: [{ ...promptNode, position: { x: 1, y: 0 } }, generatorNode],
      }),
    ).toBe(false);
  });
});
