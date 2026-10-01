import { Caption1, makeStyles, tokens } from '@fluentui/react-components';
import type { ValueNode } from '../../csdl/annotations.ts';

const useStyles = makeStyles({
  list: {
    listStyle: 'none',
    margin: 0,
    paddingInlineStart: tokens.spacingHorizontalM,
    borderLeft: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  root: { listStyle: 'none', margin: 0, padding: 0 },
  label: { color: tokens.colorNeutralForeground3, marginInlineEnd: tokens.spacingHorizontalXS },
  text: { fontFamily: tokens.fontFamilyMonospace, overflowWrap: 'anywhere' },
  heading: { color: tokens.colorNeutralForeground2 },
});

function Node({ node }: { node: ValueNode }) {
  const styles = useStyles();
  const group = node.kind === 'record' || node.kind === 'collection';
  return (
    <li>
      {node.label !== undefined && <span className={styles.label}>{node.label}:</span>}
      <span className={group ? styles.heading : styles.text}>{node.text}</span>
      {node.children.length > 0 && (
        <ul className={styles.list}>
          {node.children.map((child, i) => (
            <Node key={i} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** A generic view of an annotation value: records and collections nest, everything else is a leaf. */
export function ValueTree({ node }: { node: ValueNode }) {
  const styles = useStyles();
  if (node.children.length === 0) {
    return <Caption1 className={styles.text}>{node.text}</Caption1>;
  }
  return (
    <ul className={styles.root}>
      <Node node={node} />
    </ul>
  );
}
