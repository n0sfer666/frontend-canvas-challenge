export type ErrorHint = { message: string; action?: string };

const byCode: Record<string, ErrorHint> = {
  NETWORK_ERROR: {
    message: 'Сервер недоступен.',
    action: 'Проверьте, что API запущен, и повторите действие.',
  },
  GRAPH_VERSION_CONFLICT: {
    message: 'Граф изменился на сервере.',
    action: 'Ваши правки сохранены локально: перечитайте серверный граф.',
  },
  PRECONDITION_REQUIRED: {
    message: 'Не хватает версии графа.',
    action: 'Перечитайте граф и повторите сохранение.',
  },
  INVALID_GRAPH: {
    message: 'Сервер не принял связи графа.',
    action: 'Соедините текст с генератором, а генератор с результатом.',
  },
  GRAPH_CHANGED: {
    message: 'Граф не был сохранён до запуска.',
    action: 'Дождитесь сохранения и запустите генерацию снова.',
  },
  GENERATION_IN_PROGRESS: {
    message: 'У этого генератора уже идёт генерация.',
    action: 'Дождитесь её завершения.',
  },
  IDEMPOTENCY_CONFLICT: {
    message: 'Ключ запуска уже использован с другими данными.',
    action: 'Запустите генерацию заново.',
  },
  GENERATOR_REQUIRED: { message: 'Запуск возможен только с ноды генератора.' },
  INCOMPLETE_CHAIN: {
    message: 'Цепочка не собрана.',
    action: 'Соедините непустой текст, генератор и результат.',
  },
  SPACE_NOT_FOUND: {
    message: 'Пространство не найдено.',
    action: 'Создайте новое или выберите другое.',
  },
  GENERATION_NOT_FOUND: { message: 'Генерация не найдена.' },
  VALIDATION_ERROR: { message: 'Сервер отклонил данные запроса.' },
  PAYLOAD_TOO_LARGE: { message: 'Граф слишком большой для сохранения.' },
  EMPTY_RESPONSE: { message: 'Сервер вернул пустой ответ.', action: 'Повторите запрос.' },
};

const byStatus: Record<number, string> = {
  400: 'INVALID_REQUEST',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  412: 'GRAPH_VERSION_CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'INVALID_GRAPH',
  428: 'PRECONDITION_REQUIRED',
  500: 'INTERNAL_ERROR',
};

export const codeForStatus = (status: number) => byStatus[status] ?? 'REQUEST_FAILED';

export const hintFor = (code: string, fallback?: string): ErrorHint =>
  byCode[code] ?? { message: fallback?.trim() || 'Запрос не удалось выполнить.' };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly action: string | undefined;
  readonly requestId: string | null;
  readonly isNetwork: boolean;

  constructor(init: {
    status: number;
    code: string;
    serverMessage?: string;
    requestId?: string | null;
  }) {
    const hint = hintFor(init.code, init.serverMessage);
    super(hint.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.action = hint.action;
    this.requestId = init.requestId ?? null;
    this.isNetwork = init.code === 'NETWORK_ERROR';
  }
}

export const isApiError = (value: unknown): value is ApiError => value instanceof ApiError;

export const errorText = (value: unknown): string =>
  isApiError(value)
    ? [value.message, value.action].filter(Boolean).join(' ')
    : 'Непредвиденная ошибка.';
