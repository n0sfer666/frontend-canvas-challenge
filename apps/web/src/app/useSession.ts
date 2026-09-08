import { useCallback, useEffect, useReducer, useState } from 'react';
import type { Api } from '@/api/endpoints';
import { errorText } from '@/api/errors';
import type { ApiConfig, GenerationData, GenerationScenario, GraphSnapshot } from '@/api/types';
import { createGenerations } from '@/graph/generation';
import { chainOf } from '@/graph/rules';
import { createGraphSync } from '@/graph/sync';
import type { SyncState } from '@/graph/sync';
import { newId } from './ids';
import { useGraphDraft } from './useGraphDraft';

export type SessionApi = Pick<Api, 'getGraph' | 'saveGraph' | 'startGeneration' | 'getGeneration'>;

type Input = {
  api: SessionApi;
  spaceId: string;
  snapshot: GraphSnapshot;
  config: Pick<ApiConfig, 'debounceMs' | 'pollIntervalMs' | 'maxNodes' | 'maxEdges'>;
  history: readonly GenerationData[];
};

const incomplete =
  'Соедините текстовую ноду с генератором, генератор — с результатом и заполните описание.';

const linkHint = 'Выберите вход другой ноды и нажмите Enter, чтобы создать связь.';

const sourceFirst = 'Сначала выберите выход ноды-источника.';

export const useSession = ({ api, spaceId, snapshot, config, history }: Input) => {
  const [save, setSave] = useState<SyncState>({ status: 'saved' });
  const [, bump] = useReducer((tick: number) => tick + 1, 0);
  const [restored] = useState(history);
  const [linking, setLinking] = useState<string | null>(null);

  const [{ sync, runs }] = useState(() => {
    const graphSync = createGraphSync({
      etag: snapshot.etag,
      graph: snapshot.graph,
      debounceMs: config.debounceMs,
      save: (input) => api.saveGraph({ spaceId, graph: input.graph, etag: input.etag }),
      onState: setSave,
    });
    const generations = createGenerations({
      spaceId,
      pollIntervalMs: config.pollIntervalMs,
      flush: graphSync.flush,
      newKey: newId,
      api,
      onChange: bump,
    });
    return { sync: graphSync, runs: generations };
  });

  const [limits] = useState({ maxNodes: config.maxNodes, maxEdges: config.maxEdges });
  const draft = useGraphDraft(snapshot.graph, limits, sync.schedule);
  const { setNotice, replace, connect } = draft;

  useEffect(() => {
    sync.resume();
    runs.resume();
    runs.adopt(restored);
    return () => {
      sync.dispose();
      runs.dispose();
    };
  }, [sync, runs, restored]);

  const generate = useCallback(
    async (generatorId: string, scenario: GenerationScenario) => {
      const chain = chainOf(draft.graph(), generatorId);
      const text = chain.prompt?.data.text.trim() ?? '';
      if (text === '' || chain.resultNodeId === undefined) {
        setNotice(incomplete);
        return;
      }
      setNotice(null);
      await runs.start(generatorId, scenario);
      const run = runs.runFor(generatorId);
      if (run?.status === 'error') setNotice(errorText(run.error));
    },
    [draft, runs, setNotice],
  );

  const reload = useCallback(async () => {
    try {
      const fresh = await api.getGraph(spaceId);
      sync.reset(fresh);
      replace(fresh.graph);
    } catch (error) {
      setNotice(errorText(error));
    }
  }, [api, spaceId, sync, replace, setNotice]);

  const retrySave = useCallback(async () => {
    try {
      await sync.flush();
    } catch (error) {
      setNotice(errorText(error));
    }
  }, [sync, setNotice]);

  const removeNode = useCallback(
    (nodeId: string) => {
      draft.removeNode(nodeId);
      runs.forget(nodeId);
      setLinking((current) => (current === nodeId ? null : current));
    },
    [draft, runs],
  );

  const pickSource = useCallback(
    (nodeId: string) => {
      setLinking(nodeId);
      setNotice(linkHint);
    },
    [setNotice],
  );

  const linkTo = useCallback(
    (nodeId: string) => {
      if (linking === null) {
        setNotice(sourceFirst);
        return;
      }
      connect({ source: linking, target: nodeId });
      setLinking(null);
    },
    [linking, connect, setNotice],
  );

  const dismissNotice = useCallback(() => {
    setNotice(null);
  }, [setNotice]);

  return {
    nodes: draft.flow.nodes,
    edges: draft.flow.edges,
    viewport: draft.flow.viewport,
    revision: draft.revision,
    notice: draft.notice,
    save,
    linking,
    addNode: draft.addNode,
    connect,
    removeNode,
    updateText: draft.updateText,
    onNodesChange: draft.onNodesChange,
    onEdgesChange: draft.onEdgesChange,
    onViewportChange: draft.onViewportChange,
    dismissNotice,
    pickSource,
    linkTo,
    generate,
    reload,
    retrySave,
    runFor: runs.runFor,
    resultFor: runs.resultFor,
  };
};

export type Session = ReturnType<typeof useSession>;
