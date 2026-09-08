import type { NodeProps } from '@xyflow/react';
import { useSessionContext } from '@/app/session-context';
import type { PromptFlowNode } from '@/graph/serialize';
import { cx } from '../cx';
import { noDrag, noWheel } from './flowClasses';
import { NodeFrame } from './NodeFrame';
import styles from './node.module.css';

export const PromptNode = ({ id, data }: NodeProps<PromptFlowNode>) => {
  const { updateText } = useSessionContext();

  return (
    <NodeFrame kind="prompt" nodeId={id}>
      <label className={styles.node__label} htmlFor={`prompt-${id}`}>
        Описание изображения
      </label>
      <textarea
        id={`prompt-${id}`}
        className={cx(styles.node__input, noDrag, noWheel)}
        value={data.text}
        rows={4}
        maxLength={2000}
        placeholder="Например: горный хребет на рассвете"
        onChange={(event) => {
          updateText(id, event.target.value);
        }}
      />
    </NodeFrame>
  );
};
