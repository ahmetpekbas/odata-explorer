import {
  Badge,
  Body1,
  Caption1,
  makeStyles,
  Subtitle2,
  Tooltip,
  tokens,
} from '@fluentui/react-components';
import { annotationsOf, groupByVocabulary, termName } from '../../app/inspector.ts';
import type { DetailMode } from '../../app/store.ts';
import { expressionTree } from '../../csdl/annotations.ts';
import { descriptionOf } from '../../csdl/humanize.ts';
import type { Annotation } from '../../csdl/model.ts';
import type { Resolved } from '../../csdl/resolve.ts';
import { summarizeAnnotation } from '../../csdl/term-summaries.ts';
import { lookupTerm } from '../../vocabularies/index.ts';
import { ValueTree } from './ValueTree.tsx';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalM,
  },
  target: { color: tokens.colorNeutralForeground3, overflowWrap: 'anywhere' },
  group: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS },
  heading: { margin: 0 },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    paddingBottom: tokens.spacingVerticalS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
  },
  title: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  term: { fontWeight: tokens.fontWeightSemibold, cursor: 'help' },
  full: {
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
    overflowWrap: 'anywhere',
  },
  summary: { overflowWrap: 'anywhere' },
});

function AnnotationItem({ annotation, mode }: { annotation: Annotation; mode: DetailMode }) {
  const styles = useStyles();
  const summary = summarizeAnnotation(annotation);
  const showValue =
    annotation.value !== undefined && (summary === undefined || mode === 'technical');
  // The bundled vocabulary describes its own terms; anything else is just named.
  const term = lookupTerm(annotation.term);
  const description = term && descriptionOf(term);
  return (
    <li className={styles.item}>
      <div className={styles.title}>
        <Tooltip content={description ?? annotation.term} relationship="description">
          <span className={styles.term} tabIndex={0}>
            {termName(annotation.term)}
          </span>
        </Tooltip>
        {annotation.qualifier && (
          <Badge appearance="outline" size="small">
            #{annotation.qualifier}
          </Badge>
        )}
        <Badge
          appearance="tint"
          size="small"
          color={annotation.origin === 'external' ? 'important' : 'informative'}
        >
          {annotation.origin}
        </Badge>
      </div>
      {mode === 'technical' && <Caption1 className={styles.full}>{annotation.term}</Caption1>}
      {(summary !== undefined || annotation.value === undefined) && (
        <Body1 className={styles.summary}>{summary ?? 'true'}</Body1>
      )}
      {showValue && annotation.value && <ValueTree node={expressionTree(annotation.value)} />}
    </li>
  );
}

interface AnnotationsPanelProps {
  resolved: Resolved;
  /** ID of the selected element, or of the active tab. */
  id: string | undefined;
  mode: DetailMode;
}

/** The annotations of the selected element, grouped by vocabulary with their qualifier and origin. */
export function AnnotationsPanel({ resolved, id, mode }: AnnotationsPanelProps) {
  const styles = useStyles();
  const annotations = annotationsOf(resolved, id);
  if (id === undefined) {
    return (
      <div className={styles.root}>
        <Body1>Select an element to see its annotations.</Body1>
      </div>
    );
  }
  const groups = groupByVocabulary(annotations);
  return (
    <div className={styles.root}>
      <Caption1 className={styles.target}>{id}</Caption1>
      {groups.length === 0 && <Body1>No annotations on this element.</Body1>}
      {groups.map((group) => (
        <section key={group.namespace} className={styles.group} aria-label={group.vocabulary}>
          <Subtitle2 as="h3" className={styles.heading}>
            {group.vocabulary}
          </Subtitle2>
          <ul className={styles.list}>
            {group.annotations.map((annotation, i) => (
              <AnnotationItem key={i} annotation={annotation} mode={mode} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
