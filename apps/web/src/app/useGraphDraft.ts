import { applyEdgeChanges, applyNodeChanges } from '@xyflow/react';
import type { EdgeChange, NodeChange } from '@xyflow/react';
import { useCallback, useRef, useState } from 'react';
import type { GraphData, NodeKind, Viewport } from '@/api/types';
import type { Connection } from '@/graph/rules';
import { canConnect, createNode, placeNode } from '@/graph/rules';
import type { FlowEdge, FlowGraph, FlowNode } from '@/graph/serialize';
import { pruneEdges, toFlow, toFlowNode, toGraph } from '@/graph/serialize';
import { newId } from './ids';

export type GraphLimits = { maxNodes: number; maxEdges: number };

export const useGraphDraft = (
  initial: GraphData,
  limits: GraphLimits,
  onChange: (graph: GraphData) => void,
) => {
  const [flow, setFlow] = useState<FlowGraph>(() => toFlow(initial));
  const [notice, setNotice] = useState<string | null>(null);
  const current = useRef<FlowGraph>(flow);

  const edit = useCallback(
    (update: (draft: FlowGraph) => FlowGraph) => {
      const next = update(current.current);
      const pruned = { ...next, edges: pruneEdges(next.nodes, next.edges) };
      current.current = pruned;
      setFlow(pruned);
      onChange(toGraph(pruned));
    },
    [onChange],
  );

  const replace = useCallback((graph: GraphData) => {
    const next = toFlow(graph);
    current.current = next;
    setFlow(next);
    setNotice(null);
  }, []);

  const addNode = useCallback(
    (kind: NodeKind) => {
      if (current.current.nodes.length >= limits.maxNodes) {
        setNotice(`Больше ${String(limits.maxNodes)} нод сервер не примет. Удалите лишние ноды.`);
        return;
      }
      setNotice(null);
      edit((draft) => {
        const index = draft.nodes.filter((node) => node.type === kind).length;
        const created = createNode(kind, placeNode(kind, index), newId());
        return { ...draft, nodes: [...draft.nodes, toFlowNode(created)] };
      });
    },
    [edit, limits.maxNodes],
  );

  const connect = useCallback(
    ({ source, target }: Connection) => {
      if (current.current.edges.length >= limits.maxEdges) {
        setNotice(
          `Больше ${String(limits.maxEdges)} связей сервер не примет. Удалите лишние связи.`,
        );
        return;
      }
      const verdict = canConnect(toGraph(current.current), { source, target });
      if (!verdict.ok) {
        setNotice(verdict.reason);
        return;
      }
      setNotice(null);
      edit((draft) => ({ ...draft, edges: [...draft.edges, { id: newId(), source, target }] }));
    },
    [edit, limits.maxEdges],
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      edit((draft) => ({ ...draft, nodes: draft.nodes.filter((node) => node.id !== nodeId) }));
    },
    [edit],
  );

  const updateText = useCallback(
    (nodeId: string, text: string) => {
      edit((draft) => ({
        ...draft,
        nodes: draft.nodes.map((node) =>
          node.id === nodeId && node.type === 'prompt' ? { ...node, data: { text } } : node,
        ),
      }));
    },
    [edit],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      edit((draft) => ({ ...draft, nodes: applyNodeChanges(changes, draft.nodes) }));
    },
    [edit],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<FlowEdge>[]) => {
      edit((draft) => ({ ...draft, edges: applyEdgeChanges(changes, draft.edges) }));
    },
    [edit],
  );

  const onViewportChange = useCallback(
    (viewport: Viewport) => {
      edit((draft) => ({ ...draft, viewport }));
    },
    [edit],
  );

  return {
    flow,
    notice,
    setNotice,
    graph: useCallback(() => toGraph(current.current), []),
    replace,
    addNode,
    connect,
    removeNode,
    updateText,
    onNodesChange,
    onEdgesChange,
    onViewportChange,
  };
};

export type GraphDraft = ReturnType<typeof useGraphDraft>;
