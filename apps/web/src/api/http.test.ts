import { Type } from '@sinclair/typebox';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, isApiError } from './errors';
import { createHttp } from './http';

const Body = Type.Object({ nodes: Type.Array(Type.String()) });

const ok = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

const setup = (reply: () => Promise<Response>) => {
  const fetchMock = vi.fn<typeof fetch>(reply);
  return { fetchMock, http: createHttp({ baseUrl: 'http://api.test', fetch: fetchMock }) };
};

const failure = async (promise: Promise<unknown>) => {
  const value: unknown = await promise.catch((error: unknown) => error);
  if (!isApiError(value)) throw new Error('Ожидалась ошибка ApiError');
  return value;
};

describe('createHttp', () => {
  it('собирает адрес из базового и пути, читает тело и заголовки ответа', async () => {
    const { http, fetchMock } = setup(() =>
      Promise.resolve(
        ok({ nodes: [] }, { headers: { 'content-type': 'application/json', etag: '"a1"' } }),
      ),
    );

    const response = await http({ method: 'GET', path: '/api/graph', schema: Body });

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

    const init = fetchMock.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"title":"Канвас"}');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('idempotency-key')).toBe('key-123');
    expect(headers.has('if-match')).toBe(false);
  });

  it('не разбирает тело у ответов без содержимого', async () => {
    const { http } = setup(() => Promise.resolve(new Response(null, { status: 304 })));

    const response = await http({ method: 'GET', path: '/api/graph', schema: Body });

    expect(response.status).toBe(304);
    expect(response.data).toBeNull();
  });

  it('отклоняет тело, не совпавшее с контрактом', async () => {
    const { http } = setup(() => Promise.resolve(ok({ nodes: [1, 2] })));

    const error = await failure(http({ method: 'GET', path: '/api/graph', schema: Body }));

    expect(error.code).toBe('INVALID_RESPONSE');
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

    const error = await failure(http({ method: 'PUT', path: '/api/graph' }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 412, code: 'GRAPH_VERSION_CONFLICT', requestId: 'req-7' });
    expect(error.message).toMatch(/изменил/i);
  });

  it('описывает ответ без разбираемого тела ошибки', async () => {
    const { http } = setup(() => Promise.resolve(new Response('<html>', { status: 500 })));

    const error = await failure(http({ method: 'GET', path: '/api/graph' }));

    expect(error.status).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
  });

  it('помечает сетевой сбой как повторяемый', async () => {
    const { http } = setup(() => Promise.reject(new TypeError('Failed to fetch')));

    const error = await failure(http({ method: 'POST', path: '/api/spaces' }));

    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.isNetwork).toBe(true);
  });

  it('пробрасывает отмену запроса без обёртки', async () => {
    const controller = new AbortController();
    const { http } = setup(() => Promise.reject(new DOMException('Aborted', 'AbortError')));
    controller.abort();

    const error: unknown = await http({
      method: 'GET',
      path: '/api/graph',
      signal: controller.signal,
    }).catch((value: unknown) => value);

    expect(error).toBeInstanceOf(DOMException);
    expect(error).toMatchObject({ name: 'AbortError' });
  });
});
