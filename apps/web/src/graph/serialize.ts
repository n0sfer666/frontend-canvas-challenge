import type { Edge, Node } from '@xyflow/react';
import type { GraphData, GraphEdge, GraphNode, NodeKind, Viewport } from '@/api/types';

export type FlowNode = Node<GraphNode['data'], NodeKind>;
export type FlowEdge = Edge;
export type FlowGraph = { nodes: FlowNode[]; edges: FlowEdge[]; viewport: Viewport };

export const toFlowNode = (node: GraphNode): FlowNode => ({
  id: node.id,
  type: node.type,
  position: { ...node.position },
  data: { ...node.data },
});

const toGraphNode = (node: FlowNode): GraphNode | null => {
  const position = { x: Math.round(node.position.x), y: Math.round(node.position.y) };
  if (node.type === 'prompt' && 'text' in node.data)
    return { id: node.id, type: 'prompt', position, data: { text: node.data.text } };
  if (node.type === 'generator' && 'label' in node.data)
    return { id: node.id, type: 'generator', position, data: { label: node.data.label } };
  if (node.type === 'result' && 'label' in node.data)
    return { id: node.id, type: 'result', position, data: { label: node.data.label } };
  return null;
};

export const pruneEdges = <TEdge extends { source: string; target: string }>(
  nodes: readonly { id: string }[],
  edges: readonly TEdge[],
): TEdge[] => {
  const alive = new Set(nodes.map((node) => node.id));
  return edges.filter((edge) => alive.has(edge.source) && alive.has(edge.target));
};

export const toFlow = (graph: GraphData): FlowGraph => ({
  nodes: graph.nodes.map(toFlowNode),
  edges: graph.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
  viewport: { ...graph.viewport },
});

export const toGraph = ({ nodes, edges, viewport }: FlowGraph): GraphData => {
  const kept: GraphNode[] = [];
  for (const node of nodes) {
    const saved = toGraphNode(node);
    if (saved !== null) kept.push(saved);
  }
  const links: GraphEdge[] = pruneEdges(kept, edges).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }));
  return { nodes: kept, edges: links, viewport: { ...viewport } };
};

export const sameGraph = (a: GraphData, b: GraphData) => JSON.stringify(a) === JSON.stringify(b);
