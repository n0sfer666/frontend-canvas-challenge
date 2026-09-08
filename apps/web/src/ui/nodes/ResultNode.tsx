import type { NodeProps } from '@xyflow/react';
import { useSessionContext } from '@/app/session-context';
import type { ResultFlowNode } from '@/graph/serialize';
import { NodeFrame } from './NodeFrame';
import styles from './node.module.css';

export const ResultNode = ({ id }: NodeProps<ResultFlowNode>) => {
  const { resultFor } = useSessionContext();
  const result = resultFor(id);

  return (
    <NodeFrame kind="result" nodeId={id}>
      {result === null && (
        <p className={styles.node__state}>Здесь появится изображение после генерации.</p>
      )}
      {result?.status === 'processing' && (
        <p className={styles.node__state} role="status">
          Ждём изображение от сервера…
        </p>
      )}
      {result?.status === 'failed' && (
        <p className={styles.node__state} data-status="failed" role="status">
          Генерация отклонена сервером ({result.failureCode ?? 'без кода'}). Запустите её ещё раз.
        </p>
      )}
      {result?.status === 'succeeded' && result.imageUrl !== null && (
        <img className={styles.node__image} src={result.imageUrl} alt="Результат генерации" />
      )}
    </NodeFrame>
  );
};
