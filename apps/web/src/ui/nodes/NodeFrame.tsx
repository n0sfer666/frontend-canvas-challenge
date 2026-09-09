import type { NodeKind } from '@/api/types';
import type { ReactNode } from 'react';

import { useSessionContext } from '@/app/session-context';
import { hasInput, hasOutput, nodeKinds } from '@/graph/rules';

import { cx } from '../cx';

import { noDrag } from './flowClasses';
import styles from './node.module.css';
import { NodePort } from './NodePort';

interface NodeFrameProps {
  kind: NodeKind;
  nodeId: string;
  children: ReactNode;
}

export const NodeFrame = ({ kind, nodeId, children }: NodeFrameProps) => {
  const { removeNode, pickSource, linkTo, linking } = useSessionContext();
  const spec = nodeKinds[kind];

  return (
    <section aria-label={`Нода «${spec.title}»`} className={styles.node}>
      {hasInput(kind) && (
        <NodePort
          direction="target"
          label={`Вход ноды «${spec.title}»: соединить с выбранным выходом`}
          onActivate={() => {
            linkTo(nodeId);
          }}
        />
      )}
      <header className={styles.node__header}>
        <h2 className={styles.node__title}>{spec.title}</h2>
        <button
          aria-label={`Удалить ноду «${spec.title}»`}
          className={cx(styles.node__remove, noDrag)}
          type="button"
          onClick={() => {
            removeNode(nodeId);
          }}
        >
          Удалить
        </button>
      </header>
      <p className={styles.node__hint}>{spec.hint}</p>
      <div className={styles.node__body}>{children}</div>
      {hasOutput(kind) && (
        <NodePort
          direction="source"
          label={`Выход ноды «${spec.title}»: начать связь`}
          pressed={linking === nodeId}
          onActivate={() => {
            pickSource(nodeId);
          }}
        />
      )}
    </section>
  );
};
