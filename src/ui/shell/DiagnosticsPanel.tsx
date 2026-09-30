import {
  Badge,
  Body1,
  Caption1,
  makeStyles,
  mergeClasses,
  Subtitle2,
  tokens,
} from '@fluentui/react-components';
import type { Diagnostic, Severity } from '../../csdl/model.ts';
import { locationOf } from './diagnostic-location.ts';

const useStyles = makeStyles({
  list: { listStyle: 'none', margin: 0, padding: 0 },
  row: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    alignItems: 'baseline',
    gap: tokens.spacingHorizontalM,
    width: '100%',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    border: 'none',
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    background: 'none',
    color: 'inherit',
    font: 'inherit',
    textAlign: 'start',
  },
  clickable: {
    cursor: 'pointer',
    ':hover': { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  location: { color: tokens.colorNeutralForeground3, fontFamily: tokens.fontFamilyMonospace },
});

const SEVERITY_ORDER: Severity[] = ['error', 'warning', 'info'];
const SEVERITY_COLOR = { error: 'danger', warning: 'warning', info: 'informative' } as const;

interface DiagnosticsPanelProps {
  diagnostics: readonly Diagnostic[];
  /** Called with the chosen entry; rows are not interactive without it. */
  onSelect?: (diagnostic: Diagnostic) => void;
}

export function DiagnosticsPanel({ diagnostics, onSelect }: DiagnosticsPanelProps) {
  const styles = useStyles();
  // Errors first; within a severity the order the problems were found in.
  const sorted = SEVERITY_ORDER.flatMap((s) => diagnostics.filter((d) => d.severity === s));

  return (
    <section aria-label="Diagnostics">
      <Subtitle2>Problems ({diagnostics.length})</Subtitle2>
      {sorted.length === 0 ? (
        <Body1 block>No problems found.</Body1>
      ) : (
        <ul className={styles.list}>
          {sorted.map((d, i) => (
            <li key={i}>
              <button
                type="button"
                className={mergeClasses(styles.row, onSelect && styles.clickable)}
                disabled={!onSelect}
                onClick={() => onSelect?.(d)}
              >
                <Badge appearance="tint" color={SEVERITY_COLOR[d.severity]}>
                  {d.severity}
                </Badge>
                <span>
                  <Body1 block>{d.message}</Body1>
                  <Caption1>{d.code}</Caption1>
                </span>
                <Caption1 className={styles.location}>{locationOf(d)}</Caption1>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
