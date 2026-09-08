import type { GraphData, GraphNode, NodeKind, Viewport } from '@/api/types';

type NodeKindSpec = {
  title: string;
  hint: string;
  accepts: readonly NodeKind[];
  singleOutput: boolean;
  createData: () => GraphNode['data'];
};

export const nodeKinds: Record<NodeKind, NodeKindSpec> = {
  prompt: {
    title: 'Текст',
    hint: 'Опишите изображение и соедините с генератором.',
    accepts: [],
    singleOutput: false,
    createData: () => ({ text: '' }),
  },
  generator: {
    title: 'Генератор',
    hint: 'Принимает текст и отдаёт результат.',
    accepts: ['prompt'],
    singleOutput: true,
    createData: () => ({ label: 'Генератор' }),
  },
  result: {
    title: 'Результат',
    hint: 'Показывает изображение генератора.',
    accepts: ['generator'],
    singleOutput: false,
    createData: () => ({ label: 'Результат' }),
  },
};

export const nodeKindList = Object.keys(nodeKinds) as NodeKind[];

export const hasInput = (kind: NodeKind) => nodeKinds[kind].accepts.length > 0;
export const hasOutput = (kind: NodeKind) =>
  nodeKindList.some((other) => nodeKinds[other].accepts.includes(kind));

export const createNode = (
  kind: NodeKind,
  position: Viewport | { x: number; y: number },
  id: string,
): GraphNode =>
  ({
    id,
    type: kind,
    position: { x: position.x, y: position.y },
    data: nodeKinds[kind].createData(),
  }) as GraphNode;

export type Connection = { source: string; target: string };
export type Verdict = { ok: true } | { ok: false; reason: string };

const deny = (reason: string): Verdict => ({ ok: false, reason });

export const canConnect = (graph: GraphData, { source, target }: Connection): Verdict => {
  if (source === target) return deny('Нода не соединяется сама с собой.');

  const from = graph.nodes.find((node) => node.id === source);
  const to = graph.nodes.find((node) => node.id === target);
  if (!from || !to) return deny('Одна из нод больше не существует.');

  if (!nodeKinds[to.type].accepts.includes(from.type))
    return deny(
      `${nodeKinds[to.type].title} принимает связь только от ноды «${
        nodeKinds[to.type].accepts.map((kind) => nodeKinds[kind].title).join('», «') ||
        'другого типа'
      }». Соедините текст с генератором, а генератор с результатом.`,
    );

  if (graph.edges.some((edge) => edge.target === target))
    return deny(`У входа ноды «${nodeKinds[to.type].title}» уже есть связь. Сначала удалите её.`);

  if (nodeKinds[from.type].singleOutput && graph.edges.some((edge) => edge.source === source))
    return deny(`У ноды «${nodeKinds[from.type].title}» уже есть выходная связь.`);

  return { ok: true };
};

export const detachNode = (graph: GraphData, nodeId: string): GraphData => ({
  ...graph,
  nodes: graph.nodes.filter((node) => node.id !== nodeId),
  edges: graph.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
});

export const chainOf = (graph: GraphData, generatorId: string) => {
  const input = graph.edges.find((edge) => edge.target === generatorId);
  const output = graph.edges.find((edge) => edge.source === generatorId);
  const source = graph.nodes.find((node) => node.id === input?.source);
  return {
    prompt: source?.type === 'prompt' ? source : undefined,
    resultNodeId: output?.target,
  };
};
