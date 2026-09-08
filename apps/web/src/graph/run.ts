import type { GenerationScenario, GenerationStatus } from '@/api/types';

export type RunStatus = 'saving' | 'starting' | GenerationStatus | 'error';

export type RunRequest = { graphETag: string; scenario: GenerationScenario };

export type Run = {
  generatorId: string;
  resultNodeId: string | null;
  generationId: string | null;
  status: RunStatus;
  imageUrl: string | null;
  failureCode: string | null;
  error: unknown;
  key: string;
  attempt: number;
  request: RunRequest | null;
};

export type ResultView = {
  generationId: string;
  status: GenerationStatus;
  imageUrl: string | null;
  failureCode: string | null;
  attempt: number;
};
