import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupSession as setup, settle } from '@/test/session';

describe('useSession: генерация', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('генерация дожидается сохранения и запускает сохранённую версию', async () => {
    const { view, saveGraph, startGeneration } = setup();

    act(() => {
      view.result.current.addNode('prompt');
      view.result.current.addNode('generator');
      view.result.current.addNode('result');
    });
    const [prompt, generator, result] = view.result.current.nodes;
    act(() => {
      view.result.current.connect({ source: prompt?.id ?? '', target: generator?.id ?? '' });
      view.result.current.connect({ source: generator?.id ?? '', target: result?.id ?? '' });
      view.result.current.updateText(prompt?.id ?? '', 'горы на рассвете');
    });

    await act(async () => {
      await view.result.current.generate(generator?.id ?? '', 'success');
    });

    expect(saveGraph).toHaveBeenCalledOnce();
    expect(startGeneration).toHaveBeenCalledOnce();
    expect(startGeneration.mock.calls[0]?.[0]).toMatchObject({
      nodeId: generator?.id,
      graphETag: '"v2"',
    });
  });

  it('повторный монтаж в StrictMode оставляет сессию рабочей', async () => {
    const { view, saveGraph } = setup({ strict: true });

    act(() => {
      view.result.current.addNode('prompt');
    });
    await settle();

    expect(saveGraph).toHaveBeenCalledOnce();
    expect(view.result.current.save.status).toBe('saved');
  });
});
