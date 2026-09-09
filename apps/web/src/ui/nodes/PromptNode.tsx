import type { PromptFlowNode } from '@/graph/serialize';
import type { NodeProps } from '@xyflow/react';

import { useSessionContext } from '@/app/session-context';

import { cx } from '../cx';

import { noDrag, noWheel } from './flowClasses';
import styles from './node.module.css';
import { NodeFrame } from './NodeFrame';

export const PromptNode = ({ id, data }: NodeProps<PromptFlowNode>) => {
  const { updateText } = useSessionContext();

  return (
    <NodeFrame kind="prompt" nodeId={id}>
      <label className={styles.node__label} htmlFor={`prompt-${id}`}>
        Описание изображения
      </label>
      <textarea
        className={cx(styles.node__input, noDrag, noWheel)}
        id={`prompt-${id}`}
        maxLength={2000}
        placeholder="Например: горный хребет на рассвете"
        rows={4}
        value={data.text}
        onChange={(event) => {
          updateText(id, event.target.value);
        }}
      />
    </NodeFrame>
  );
};
