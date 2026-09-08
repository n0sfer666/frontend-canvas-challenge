import { Handle, Position } from '@xyflow/react';
import type { ReactNode } from 'react';
import type { NodeKind } from '@/api/types';
import { useSessionContext } from '@/app/session-context';
import { hasInput, hasOutput, nodeKinds } from '@/graph/rules';
import styles from './node.module.css';

interface NodeFrameProps {
  kind: NodeKind;
  nodeId: string;
  children: ReactNode;
}

export const NodeFrame = ({ kind, nodeId, children }: NodeFrameProps) => {
  const { removeNode } = useSessionContext();
  const spec = nodeKinds[kind];

  return (
    <section className={styles.node} aria-label={`Нода «${spec.title}»`}>
      {hasInput(kind) && (
        <Handle
          type="target"
          position={Position.Left}
          className={styles.node__port}
          aria-label={`Вход ноды «${spec.title}»`}
        />
      )}
      <header className={styles.node__header}>
        <h2 className={styles.node__title}>{spec.title}</h2>
        <button
          type="button"
          className={styles.node__remove}
          onClick={() => {
            removeNode(nodeId);
          }}
          aria-label={`Удалить ноду «${spec.title}»`}
        >
          Удалить
        </button>
      </header>
      <p className={styles.node__hint}>{spec.hint}</p>
      <div className={styles.node__body}>{children}</div>
      {hasOutput(kind) && (
        <Handle
          type="source"
          position={Position.Right}
          className={styles.node__port}
          aria-label={`Выход ноды «${spec.title}»`}
        />
      )}
    </section>
  );
};
