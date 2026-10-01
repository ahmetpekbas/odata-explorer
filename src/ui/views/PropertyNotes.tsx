import { Badge, makeStyles, tokens } from '@fluentui/react-components';
import type { PropertyHints } from '../../csdl/term-summaries.ts';

const useStyles = makeStyles({
  notes: { display: 'inline-flex', alignItems: 'center', gap: tokens.spacingHorizontalXS },
});

/** The Computed and Immutable markers and the validation rules of a property, for a table cell. */
export function PropertyNotes({ hints }: { hints: PropertyHints }) {
  const styles = useStyles();
  const rules = hints.rules.join('; ');
  return (
    <span className={styles.notes} title={rules === '' ? undefined : rules}>
      {hints.computed && (
        <Badge size="small" appearance="tint" color="informative">
          Computed
        </Badge>
      )}
      {hints.immutable && (
        <Badge size="small" appearance="tint" color="warning">
          Immutable
        </Badge>
      )}
      {rules}
    </span>
  );
}
