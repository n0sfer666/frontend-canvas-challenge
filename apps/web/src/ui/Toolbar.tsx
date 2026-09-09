import { useSessionContext } from '@/app/session-context';
import { nodeKindList, nodeKinds } from '@/graph/rules';

import styles from './toolbar.module.css';

export const Toolbar = () => {
  const { addNode } = useSessionContext();

  return (
    <div aria-label="Добавление нод" className={styles.toolbar} role="group">
      {nodeKindList.map((kind) => (
        <button
          key={kind}
          className={styles.toolbar__button}
          type="button"
          onClick={() => {
            addNode(kind);
          }}
        >
          Добавить ноду «{nodeKinds[kind].title}»
        </button>
      ))}
    </div>
  );
};
