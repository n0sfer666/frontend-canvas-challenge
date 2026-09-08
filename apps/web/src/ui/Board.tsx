import { Background, Controls, ReactFlow, useReactFlow } from '@xyflow/react';
import type { OnConnect } from '@xyflow/react';
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
        nodes={session.nodes}
        edges={session.edges}
        nodeTypes={nodeTypes}
        defaultViewport={viewport}
        onNodesChange={session.onNodesChange}
        onEdgesChange={session.onEdgesChange}
        onConnect={onConnect}
        onMoveEnd={(_event, moved) => {
          onViewportChange(moved);
        }}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={['Backspace', 'Delete']}
        proOptions={{ hideAttribution: true }}
        aria-label="Канвас рабочего пространства"
      >
        <Background />
        <Controls />
      </ReactFlow>
    </main>
  );
};
