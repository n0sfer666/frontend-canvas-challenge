import styles from './splash.module.css';

interface SplashProps {
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}

export const Splash = ({ title, message, action }: SplashProps) => (
  <div className={styles.splash} role="status">
    <h1 className={styles.splash__title}>{title}</h1>
    <p className={styles.splash__message}>{message}</p>
    {action !== undefined && (
      <button type="button" className={styles.splash__action} onClick={action.onClick}>
        {action.label}
      </button>
    )}
  </div>
);
