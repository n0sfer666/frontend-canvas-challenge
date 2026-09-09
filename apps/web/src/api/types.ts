import type { Config, GenerationData, GraphData, NodeData, SpaceData } from '@canvas/contracts';
import type { Static } from '@sinclair/typebox';

export type { GenerationData, GraphData, NodeData, SpaceData };

export type GraphNode = NodeData;
export type GraphEdge = GraphData['edges'][number];
export type Viewport = GraphData['viewport'];
export type NodeKind = NodeData['type'];
export type GenerationStatus = GenerationData['status'];
export type GenerationScenario = GenerationData['scenario'];

export type GraphSnapshot = { graph: GraphData; etag: string };

export type ApiConfig = Static<typeof Config>;
