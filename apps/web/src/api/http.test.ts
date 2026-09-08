import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import { createHttp } from './http';

const ok = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

const setup = (impl: (input: string, init: RequestInit) => Promise<Response>) => {
  const fetchMock = vi.fn(impl as unknown as typeof fetch);
  return {
    fetchMock,
    http: createHttp({ baseUrl: 'http://api.test', fetch: fetchMock as unknown as typeof fetch }),
  };
};

describe('createHttp', () => {
  it('собирает адрес из базового и пути, читает тело и заголовки ответа', async () => {
    const { http, fetchMock } = setup(() =>
      Promise.resolve(
        ok({ nodes: [] }, { headers: { 'content-type': 'application/json', etag: '"a1"' } }),
      ),
    );

    const response = await http<{ nodes: unknown[] }>({ method: 'GET', path: '/api/graph' });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://api.test/api/graph');
    expect(response.data).toEqual({ nodes: [] });
    expect(response.etag).toBe('"a1"');
    expect(response.status).toBe(200);
  });

  it('отправляет JSON и общие заголовки, пропуская пустые значения', async () => {
    const { http, fetchMock } = setup(() => Promise.resolve(ok({ id: 'x' }, { status: 201 })));

    await http({
      method: 'POST',
      path: '/api/spaces',
      body: { title: 'Канвас' },
      headers: { 'Idempotency-Key': 'key-123', 'If-Match': undefined },
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"title":"Канвас"}');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('idempotency-key')).toBe('key-123');
    expect(headers.has('if-match')).toBe(false);
  });

  it('не разбирает тело у ответов без содержимого', async () => {
    const { http } = setup(() => Promise.resolve(new Response(null, { status: 304 })));

    const response = await http({ method: 'GET', path: '/api/graph' });

    expect(response.status).toBe(304);
    expect(response.data).toBeNull();
  });

  it('превращает ошибку предметной области в ApiError с понятным текстом', async () => {
    const { http } = setup(() =>
      Promise.resolve(
        ok(
          { error: { code: 'GRAPH_VERSION_CONFLICT', message: 'Граф изменился.' } },
          {
            status: 412,
            headers: { 'content-type': 'application/json', 'x-request-id': 'req-7' },
          },
        ),
      ),
    );

    const error = await http({ method: 'PUT', path: '/api/graph' }).catch(
      (value: unknown) => value,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 412,
      code: 'GRAPH_VERSION_CONFLICT',
      requestId: 'req-7',
    });
    expect((error as ApiError).message).toMatch(/изменил/i);
  });

  it('описывает ответ без разбираемого тела ошибки', async () => {
    const { http } = setup(() => Promise.resolve(new Response('<html>', { status: 500 })));

    const error = (await http({ method: 'GET', path: '/api/graph' }).catch(
      (value: unknown) => value,
    )) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
  });

  it('помечает сетевой сбой как повторяемый', async () => {
    const { http } = setup(() => Promise.reject(new TypeError('Failed to fetch')));

    const error = (await http({ method: 'POST', path: '/api/spaces' }).catch(
      (value: unknown) => value,
    )) as ApiError;

    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.isNetwork).toBe(true);
  });

  it('пробрасывает отмену запроса без обёртки', async () => {
    const controller = new AbortController();
    const { http } = setup(() => Promise.reject(new DOMException('Aborted', 'AbortError')));
    controller.abort();

    const error = (await http({
      method: 'GET',
      path: '/api/graph',
      signal: controller.signal,
    }).catch((value: unknown) => value)) as Error;

    expect(error).toBeInstanceOf(DOMException);
    expect(error.name).toBe('AbortError');
  });
});
