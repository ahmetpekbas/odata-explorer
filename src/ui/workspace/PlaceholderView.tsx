import { Body1, Badge, Caption1, Title3, makeStyles, tokens } from '@fluentui/react-components';
import type { Tab } from '../../app/store.ts';
import { tabLabel } from '../../app/tab-label.ts';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalL,
  },
  id: { color: tokens.colorNeutralForeground3, fontFamily: tokens.fontFamilyMonospace },
});

/** Stands in for the detail view of a tab until the views of M5 exist. */
export function PlaceholderView({ tab }: { tab: Tab }) {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <Badge appearance="tint">{tab.kind}</Badge>
      <Title3 as="h2">{tabLabel(tab)}</Title3>
      <Caption1 className={styles.id}>{tab.id}</Caption1>
      <Body1>The detail view for this element is not built yet.</Body1>
    </div>
  );
}
