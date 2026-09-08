import { ApiError, codeForStatus } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PUT';

export type HttpRequest = {
  method: HttpMethod;
  path: string;
  body?: unknown;
  headers?: Record<string, string | undefined>;
  signal?: AbortSignal;
};

export type HttpResponse<T> = {
  status: number;
  data: T | null;
  etag: string | null;
  headers: Headers;
};

export type Http = <T>(request: HttpRequest) => Promise<HttpResponse<T>>;

type Options = { baseUrl: string; fetch?: typeof fetch; headers?: () => Record<string, string> };

const withoutBody = (response: Response) =>
  response.status === 204 ||
  response.status === 304 ||
  response.headers.get('content-length') === '0';

const readBody = async (response: Response): Promise<unknown> => {
  if (withoutBody(response)) return null;
  return response
    .clone()
    .json()
    .catch(() => null);
};

const errorFrom = (response: Response, payload: unknown) => {
  const body = payload as { error?: { code?: string; message?: string } } | null;
  return new ApiError({
    status: response.status,
    code: body?.error?.code ?? codeForStatus(response.status),
    ...(body?.error?.message === undefined ? {} : { serverMessage: body.error.message }),
    requestId: response.headers.get('x-request-id'),
  });
};

const mergeHeaders = (parts: (Record<string, string | undefined> | undefined)[]) => {
  const headers = new Headers();
  for (const part of parts)
    for (const [key, value] of Object.entries(part ?? {}))
      if (value !== undefined) headers.set(key, value);
  return headers;
};

export const createHttp = ({ baseUrl, fetch: send = fetch, headers }: Options): Http => {
  return async <T>(request: HttpRequest): Promise<HttpResponse<T>> => {
    const init: RequestInit = {
      method: request.method,
      headers: mergeHeaders([
        request.body === undefined ? undefined : { 'Content-Type': 'application/json' },
        headers?.(),
        request.headers,
      ]),
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    };

    let response: Response;
    try {
      response = await send(`${baseUrl}${request.path}`, init);
    } catch (cause) {
      if ((cause as { name?: string } | null)?.name === 'AbortError') throw cause;
      throw new ApiError({ status: 0, code: 'NETWORK_ERROR' });
    }

    const payload = await readBody(response);
    if (!response.ok && response.status !== 304) throw errorFrom(response, payload);

    return {
      status: response.status,
      data: payload as T | null,
      etag: response.headers.get('etag'),
      headers: response.headers,
    };
  };
};
