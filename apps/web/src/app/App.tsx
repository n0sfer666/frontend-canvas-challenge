import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { errorText } from '@/api/errors';
import { CanvasScreen } from '@/ui/CanvasScreen';
import { Splash } from '@/ui/Splash';
import { useApi } from './api-context';
import { browserStore, resolveSpace } from './space';

export const App = () => {
  const api = useApi();
  const [store] = useState(() => browserStore(window.localStorage));

  const config = useQuery({ queryKey: ['config'], queryFn: () => api.getConfig() });
  const space = useQuery({ queryKey: ['space'], queryFn: () => resolveSpace(api, store) });
  const spaceId = space.data?.id ?? '';
  const enabled = spaceId !== '';
  const graph = useQuery({
    queryKey: ['graph', spaceId],
    queryFn: () => api.getGraph(spaceId),
    enabled,
  });
  const history = useQuery({
    queryKey: ['generations', spaceId],
    queryFn: () => api.listGenerations(spaceId),
    enabled,
  });

  const queries = [config, space, graph, history];
  const failed = queries.find((query) => query.error !== null);
  if (failed !== undefined)
    return (
      <Splash
        title="Не удалось открыть пространство"
        message={errorText(failed.error)}
        action={{
          label: 'Повторить',
          onClick: () => {
            void failed.refetch();
          },
        }}
      />
    );

  if (!config.data || !space.data || !graph.data || !history.data)
    return <Splash title="Открываем рабочее пространство" message="Загружаем граф и историю…" />;

  return (
    <CanvasScreen
      key={space.data.id}
      space={space.data}
      snapshot={graph.data}
      config={config.data}
      history={history.data}
    />
  );
};
