import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { DismissRegular } from '@fluentui/react-icons';
import { SHORTCUTS } from '../../app/shortcuts.ts';

const useStyles = makeStyles({
  list: {
    display: 'grid',
    gridTemplateColumns: 'max-content 1fr',
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXS,
    margin: 0,
  },
  heading: {
    gridColumn: '1 / -1',
    marginTop: tokens.spacingVerticalM,
    fontWeight: tokens.fontWeightSemibold,
  },
  keys: { fontFamily: tokens.fontFamilyMonospace, fontWeight: tokens.fontWeightSemibold },
  action: { margin: 0 },
});

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const styles = useStyles();
  return (
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button appearance="subtle" aria-label="Close" icon={<DismissRegular />} />
              </DialogTrigger>
            }
          >
            Keyboard shortcuts
          </DialogTitle>
          <DialogContent>
            <dl className={styles.list}>
              {SHORTCUTS.map(({ area, items }) => (
                <Section key={area} area={area} items={items} />
              ))}
            </dl>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function Section({ area, items }: (typeof SHORTCUTS)[number]) {
  const styles = useStyles();
  return (
    <>
      <dt className={styles.heading}>{area}</dt>
      {items.map(([keys, action]) => (
        <ShortcutRow key={keys} keys={keys} action={action} />
      ))}
    </>
  );
}

function ShortcutRow({ keys, action }: { keys: string; action: string }) {
  const styles = useStyles();
  return (
    <>
      <dt className={styles.keys}>{keys}</dt>
      <dd className={styles.action}>{action}</dd>
    </>
  );
}
