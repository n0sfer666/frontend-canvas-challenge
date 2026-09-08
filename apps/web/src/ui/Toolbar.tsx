import { useSessionContext } from '@/app/session-context';
import { nodeKindList, nodeKinds } from '@/graph/rules';
import styles from './toolbar.module.css';

export const Toolbar = () => {
  const { addNode } = useSessionContext();

  return (
    <div className={styles.toolbar} role="group" aria-label="Добавление нод">
      {nodeKindList.map((kind) => (
        <button
          key={kind}
          type="button"
          className={styles.toolbar__button}
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
