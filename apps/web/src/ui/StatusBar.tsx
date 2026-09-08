import { errorText } from '@/api/errors';
import { useSessionContext } from '@/app/session-context';
import type { SyncStatus } from '@/graph/sync';
import styles from './status.module.css';

const saveText: Record<SyncStatus, string> = {
  saved: 'Все изменения сохранены',
  pending: 'Есть несохранённые изменения',
  saving: 'Сохраняем изменения…',
  error: 'Сохранение не прошло',
  conflict: 'Граф изменился на сервере, черновик остался у вас',
};

export const StatusBar = () => {
  const { save, notice, dismissNotice, retrySave, reload } = useSessionContext();
  const detail = save.status === 'error' || save.status === 'conflict' ? errorText(save.error) : '';

  return (
    <footer className={styles.status}>
      <p className={styles.status__state} data-status={save.status} role="status">
        {saveText[save.status]}
        {detail === '' ? '' : `. ${detail}`}
      </p>
      {save.status === 'error' && (
        <button
          type="button"
          className={styles.status__action}
          onClick={() => {
            void retrySave();
          }}
        >
          Повторить сохранение
        </button>
      )}
      {save.status === 'conflict' && (
        <button
          type="button"
          className={styles.status__action}
          onClick={() => {
            void reload();
          }}
        >
          Перечитать серверный граф
        </button>
      )}
      {notice !== null && (
        <p className={styles.status__notice} role="alert">
          {notice}
          <button type="button" className={styles.status__action} onClick={dismissNotice}>
            Понятно
          </button>
        </p>
      )}
    </footer>
  );
};
