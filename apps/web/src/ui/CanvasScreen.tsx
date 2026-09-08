import { ReactFlowProvider } from '@xyflow/react';
import type { ApiConfig, GenerationData, GraphSnapshot, SpaceData } from '@/api/types';
import { useApi } from '@/app/api-context';
import { SessionContext } from '@/app/session-context';
import { useSession } from '@/app/useSession';
import { Board } from './Board';
import styles from './canvas.module.css';
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

  return (
    <SessionContext.Provider value={session}>
      <ReactFlowProvider>
        <div className={styles.canvas}>
          <header className={styles.canvas__header}>
            <h1 className={styles.canvas__title}>{space.title}</h1>
            <Toolbar />
          </header>
          <Board />
          <StatusBar />
        </div>
      </ReactFlowProvider>
    </SessionContext.Provider>
  );
};
