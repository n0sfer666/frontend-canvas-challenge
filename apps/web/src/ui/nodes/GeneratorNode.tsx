import type { NodeProps } from '@xyflow/react';
import { useState } from 'react';
import type { GenerationScenario } from '@/api/types';
import { useSessionContext } from '@/app/session-context';
import type { GeneratorFlowNode } from '@/graph/serialize';
import type { RunStatus } from '@/graph/generation';
import { cx } from '../cx';
import { noDrag } from './flowClasses';
import { NodeFrame } from './NodeFrame';
import styles from './node.module.css';

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
      <select
        id={`scenario-${id}`}
        className={cx(styles.node__input, noDrag)}
        value={scenario}
        onChange={(event) => {
          setScenario(event.target.value === 'failure' ? 'failure' : 'success');
        }}
      >
        <option value="success">Успешная генерация</option>
        <option value="failure">Тестовый отказ</option>
      </select>
      <button
        type="button"
        className={cx(styles.node__submit, noDrag)}
        disabled={busy}
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
