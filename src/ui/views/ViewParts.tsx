import type { ReactNode } from 'react';
import {
  Badge,
  Body1,
  Caption1,
  makeStyles,
  Subtitle2,
  Title2,
  tokens,
} from '@fluentui/react-components';
import { useStore, type DetailMode } from '../../app/store.ts';
import { ModeToggle } from '../shell/ModeToggle.tsx';

const useStyles = makeStyles({
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    marginBottom: tokens.spacingVerticalL,
  },
  top: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
  },
  kind: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
  title: { margin: 0, overflowWrap: 'anywhere' },
  id: {
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
    overflowWrap: 'anywhere',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalL,
  },
  heading: { margin: 0 },
  facts: {
    display: 'grid',
    gridTemplateColumns: 'max-content 1fr',
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXS,
    margin: 0,
  },
  fact: { display: 'contents' },
  term: { color: tokens.colorNeutralForeground3 },
  value: { margin: 0, overflowWrap: 'anywhere' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalS },
});

interface ViewHeaderProps {
  /** What the element is, e.g. "Entity type". */
  kind: string;
  title: string;
  /** The target-path ID, shown in small type. */
  id: string;
  tabId: string;
  mode: DetailMode;
  description?: string | undefined;
  longDescription?: string | undefined;
  /** Short facts shown next to the kind, e.g. "abstract". Technical mode only. */
  badges?: string[];
}

/** Title, description and the per-view mode toggle that every view starts with. */
export function ViewHeader({
  kind,
  title,
  id,
  tabId,
  mode,
  description,
  longDescription,
  badges = [],
}: ViewHeaderProps) {
  const styles = useStyles();
  const setModeOverride = useStore((s) => s.setModeOverride);
  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <div className={styles.kind}>
          <Badge appearance="tint">{kind}</Badge>
          {mode === 'technical' &&
            badges.map((b) => (
              <Badge key={b} appearance="outline" color="informative">
                {b}
              </Badge>
            ))}
        </div>
        <ModeToggle
          mode={mode}
          onChange={(m) => setModeOverride(tabId, m)}
          label="Detail for this view"
        />
      </div>
      <Title2 as="h2" className={styles.title}>
        {title}
      </Title2>
      <Caption1 className={styles.id}>{id}</Caption1>
      {description && <Body1>{description}</Body1>}
      {longDescription && <Body1>{longDescription}</Body1>}
    </header>
  );
}

/** A titled block of a view. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <section className={styles.section}>
      <Subtitle2 as="h3" className={styles.heading}>
        {title}
      </Subtitle2>
      {children}
    </section>
  );
}

/** Label/value pairs; rows whose value is undefined are left out. */
export function Facts({ rows }: { rows: [label: string, value: ReactNode | undefined][] }) {
  const styles = useStyles();
  return (
    <dl className={styles.facts}>
      {rows.map(([label, value]) =>
        value === undefined ? null : (
          <div key={label} className={styles.fact}>
            <dt className={styles.term}>{label}</dt>
            <dd className={styles.value}>{value}</dd>
          </div>
        ),
      )}
    </dl>
  );
}

/** Inline items, such as a row of links. */
export function Chips({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <div className={styles.chips}>{children}</div>;
}
