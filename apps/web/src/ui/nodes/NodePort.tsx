import { Handle, Position } from '@xyflow/react';
import type { KeyboardEvent } from 'react';
import { cx } from '../cx';
import { noDrag } from './flowClasses';
import styles from './node.module.css';

interface NodePortProps {
  direction: 'source' | 'target';
  label: string;
  pressed?: boolean;
  onActivate: () => void;
}

export const NodePort = ({ direction, label, pressed, onActivate }: NodePortProps) => {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onActivate();
  };

  return (
    <Handle
      type={direction}
      position={direction === 'source' ? Position.Right : Position.Left}
      className={cx(styles.node__port, noDrag)}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={pressed}
      onKeyDown={onKeyDown}
    />
  );
};
