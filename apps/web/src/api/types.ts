import type { GenerationData, GraphData, NodeData, SpaceData } from '@canvas/contracts';

export type { GenerationData, GraphData, NodeData, SpaceData };

export type GraphNode = NodeData;
export type GraphEdge = GraphData['edges'][number];
export type Viewport = GraphData['viewport'];
export type NodeKind = NodeData['type'];
export type GenerationStatus = GenerationData['status'];
export type GenerationScenario = GenerationData['scenario'];

export type GraphSnapshot = { graph: GraphData; etag: string };

export type ApiConfig = {
  debounceMs: number;
  pollIntervalMs: number;
  generationDelayMs: number;
  maxNodes: number;
  maxEdges: number;
  nodeTypes: NodeKind[];
};
