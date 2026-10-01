import { makeStyles, ToggleButton, tokens } from '@fluentui/react-components';
import type { DetailMode } from '../../app/store.ts';

const useStyles = makeStyles({
  root: { display: 'inline-flex', gap: tokens.spacingHorizontalXXS },
});

const OPTIONS: { value: DetailMode; label: string }[] = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'technical', label: 'Technical' },
];

interface ModeToggleProps {
  mode: DetailMode;
  onChange: (mode: DetailMode) => void;
  /** Names the group for assistive technology, e.g. "Detail for all views". */
  label: string;
}

/** A two-way switch between the friendly and the technical presentation. */
export function ModeToggle({ mode, onChange, label }: ModeToggleProps) {
  const styles = useStyles();
  return (
    <div role="group" aria-label={label} className={styles.root}>
      {OPTIONS.map(({ value, label: text }) => (
        <ToggleButton
          key={value}
          size="small"
          appearance="subtle"
          checked={mode === value}
          onClick={() => onChange(value)}
        >
          {text}
        </ToggleButton>
      ))}
    </div>
  );
}
