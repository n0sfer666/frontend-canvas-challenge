import { Background, Controls, ReactFlow } from '@xyflow/react';
import type { OnConnect } from '@xyflow/react';
import { useCallback } from 'react';
import type { ApiConfig, GenerationData, GraphSnapshot, SpaceData } from '@/api/types';
import { useApi } from '@/app/api-context';
import { SessionContext } from '@/app/session-context';
import { useSession } from '@/app/useSession';
import styles from './canvas.module.css';
import { nodeTypes } from './nodes/nodeTypes';
import { StatusBar } from './StatusBar';
import { Toolbar } from './Toolbar';

interface CanvasScreenProps {
  space: SpaceData;
  snapshot: GraphSnapshot;
  config: ApiConfig;
  history: readonly GenerationData[];
}

export const CanvasScreen = ({ space, snapshot, config, history }: CanvasScreenProps) => {
  const api = useApi();
  const session = useSession({ api, spaceId: space.id, snapshot, config, history });
  const { connect, onViewportChange } = session;

  const onConnect = useCallback<OnConnect>(
    (connection) => {
      connect({ source: connection.source, target: connection.target });
    },
    [connect],
  );

  return (
    <SessionContext.Provider value={session}>
      <div className={styles.canvas}>
        <header className={styles.canvas__header}>
          <h1 className={styles.canvas__title}>{space.title}</h1>
          <Toolbar />
        </header>
        <main className={styles.canvas__board}>
          <ReactFlow
            nodes={session.nodes}
            edges={session.edges}
            nodeTypes={nodeTypes}
            defaultViewport={snapshot.graph.viewport}
            onNodesChange={session.onNodesChange}
            onEdgesChange={session.onEdgesChange}
            onConnect={onConnect}
            onMoveEnd={(_event, viewport) => {
              onViewportChange(viewport);
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
        <StatusBar />
      </div>
    </SessionContext.Provider>
  );
};
