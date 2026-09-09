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

  const required = [config, space, graph];
  const failed = required.find((query) => query.error !== null);

  if (failed !== undefined)
    return (
      <Splash
        action={{
          label: 'Повторить',
          onClick: () => {
            void failed.refetch();
          },
        }}
        message={errorText(failed.error)}
        title="Не удалось открыть пространство"
      />
    );

  if (!config.data || !space.data || !graph.data || history.isPending)
    return <Splash message="Загружаем граф и историю…" title="Открываем рабочее пространство" />;

  return (
    <CanvasScreen
      key={space.data.id}
      config={config.data}
      history={history.data ?? []}
      snapshot={graph.data}
      space={space.data}
    />
  );
};
