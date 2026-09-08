import { Type } from '@sinclair/typebox';
import type { TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { ApiError, codeForStatus } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PUT';

export type Schema<TData> = TSchema & { static: TData };

export type HttpRequest<TData> = {
  method: HttpMethod;
  path: string;
  schema?: Schema<TData>;
  body?: unknown;
  headers?: Record<string, string | undefined>;
  signal?: AbortSignal;
};

export type HttpResponse<TData> = {
  status: number;
  data: TData | null;
  etag: string | null;
  headers: Headers;
};

export type Http = <TData>(request: HttpRequest<TData>) => Promise<HttpResponse<TData>>;

type Options = { baseUrl: string; fetch?: typeof fetch; headers?: () => Record<string, string> };

const ErrorBody = Type.Object({
  error: Type.Object({ code: Type.String(), message: Type.Optional(Type.String()) }),
});

export const joinUrl = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

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

const named = (cause: unknown): cause is { name: unknown } =>
  typeof cause === 'object' && cause !== null && 'name' in cause;

const isAbort = (cause: unknown) => named(cause) && cause.name === 'AbortError';

const errorFrom = (response: Response, payload: unknown) => {
  const known = Value.Check(ErrorBody, payload);
  const message = known ? payload.error.message : undefined;
  return new ApiError({
    status: response.status,
    code: known ? payload.error.code : codeForStatus(response.status),
    ...(message === undefined ? {} : { serverMessage: message }),
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

const parse = <TData>(
  schema: Schema<TData> | undefined,
  payload: unknown,
  status: number,
): TData | null => {
  if (payload === null || schema === undefined) return null;
  if (Value.Check(schema, payload)) return payload;
  throw new ApiError({ status, code: 'INVALID_RESPONSE' });
};

export const createHttp = ({ baseUrl, fetch: send = fetch, headers }: Options): Http => {
  return async <TData>(request: HttpRequest<TData>) => {
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
      response = await send(joinUrl(baseUrl, request.path), init);
    } catch (cause) {
      if (isAbort(cause)) throw cause;
      throw new ApiError({ status: 0, code: 'NETWORK_ERROR' });
    }

    const payload = await readBody(response);
    if (!response.ok && response.status !== 304) throw errorFrom(response, payload);

    return {
      status: response.status,
      data: parse(request.schema, payload, response.status),
      etag: response.headers.get('etag'),
      headers: response.headers,
    };
  };
};
