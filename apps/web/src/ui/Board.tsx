import type { OnConnect } from '@xyflow/react';

import { Background, Controls, ReactFlow, useReactFlow } from '@xyflow/react';
import { useCallback, useEffect } from 'react';

import { useSessionContext } from '@/app/session-context';

import styles from './canvas.module.css';
import { nodeTypes } from './nodes/nodeTypes';

export const Board = () => {
  const session = useSessionContext();
  const { connect, onViewportChange, revision, viewport } = session;
  const { setViewport } = useReactFlow();

  useEffect(() => {
    if (revision === 0) return;
    void setViewport(viewport);
  }, [revision, setViewport, viewport]);

  const onConnect = useCallback<OnConnect>(
    (connection) => {
      connect({ source: connection.source, target: connection.target });
    },
    [connect],
  );

  return (
    <main className={styles.canvas__board}>
      <ReactFlow
        aria-label="Канвас рабочего пространства"
        defaultViewport={viewport}
        deleteKeyCode={['Backspace', 'Delete']}
        edges={session.edges}
        maxZoom={2}
        minZoom={0.2}
        nodeTypes={nodeTypes}
        nodes={session.nodes}
        proOptions={{ hideAttribution: true }}
        onConnect={onConnect}
        onEdgesChange={session.onEdgesChange}
        onMoveEnd={(_event, moved) => {
          onViewportChange(moved);
        }}
        onNodesChange={session.onNodesChange}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </main>
  );
};
