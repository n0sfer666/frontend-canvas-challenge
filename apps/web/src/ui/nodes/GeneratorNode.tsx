import type { GenerationScenario } from '@/api/types';
import type { RunStatus } from '@/graph/generation';
import type { GeneratorFlowNode } from '@/graph/serialize';
import type { NodeProps } from '@xyflow/react';

import { useState } from 'react';

import { useSessionContext } from '@/app/session-context';

import { cx } from '../cx';

import { noDrag } from './flowClasses';
import styles from './node.module.css';
import { NodeFrame } from './NodeFrame';

const runText: Record<RunStatus, string> = {
  saving: 'Сохраняем граф перед запуском…',
  starting: 'Отправляем запрос генерации…',
  processing: 'Генерация выполняется…',
  succeeded: 'Генерация завершена успешно',
  failed: 'Генерация вернула отказ',
  error: 'Запрос не прошёл, попробуйте ещё раз',
};

const busyStatuses: RunStatus[] = ['saving', 'starting', 'processing'];

export const GeneratorNode = ({ id }: NodeProps<GeneratorFlowNode>) => {
  const { generate, runFor } = useSessionContext();
  const [scenario, setScenario] = useState<GenerationScenario>('success');
  const run = runFor(id);
  const busy = run !== null && busyStatuses.includes(run.status);

  return (
    <NodeFrame kind="generator" nodeId={id}>
      <label className={styles.node__label} htmlFor={`scenario-${id}`}>
        Сценарий запуска
      </label>
      <span className={styles.node__select}>
        <select
          className={cx(styles.node__input, noDrag)}
          id={`scenario-${id}`}
          value={scenario}
          onChange={(event) => {
            setScenario(event.target.value === 'failure' ? 'failure' : 'success');
          }}
        >
          <option value="success">Успешная генерация</option>
          <option value="failure">Тестовый отказ</option>
        </select>
      </span>
      <button
        className={cx(styles.node__submit, noDrag)}
        disabled={busy}
        type="button"
        onClick={() => {
          void generate(id, scenario);
        }}
      >
        {busy ? 'Идёт генерация…' : 'Сгенерировать изображение'}
      </button>
      {run !== null && (
        <p className={styles.node__state} data-status={run.status} role="status">
          {runText[run.status]}
        </p>
      )}
    </NodeFrame>
  );
};
