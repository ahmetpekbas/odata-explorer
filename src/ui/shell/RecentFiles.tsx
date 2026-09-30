import { useEffect, useState } from 'react';
import { Body1, Button, Caption1, makeStyles, Subtitle2, tokens } from '@fluentui/react-components';
import { DeleteRegular } from '@fluentui/react-icons';
import {
  clearRecent,
  forgetRecent,
  listRecent,
  onRecentChange,
  type RecentFile,
} from '../../app/persistence.ts';
import { formatBytes } from './format-bytes.ts';

const useStyles = makeStyles({
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  open: { flex: 1, justifyContent: 'flex-start', textAlign: 'start', height: 'auto' },
  meta: { display: 'block', color: tokens.colorNeutralForeground3 },
});

interface RecentFilesProps {
  onOpen: (file: RecentFile) => void;
}

export function RecentFiles({ onOpen }: RecentFilesProps) {
  const styles = useStyles();
  const [files, setFiles] = useState<RecentFile[] | undefined>();

  useEffect(() => {
    let current = true;
    const refresh = () => {
      listRecent().then(
        (list) => current && setFiles(list),
        // IndexedDB is unavailable, e.g. in a private window: there is nothing to list.
        () => current && setFiles([]),
      );
    };
    refresh();
    const unsubscribe = onRecentChange(refresh);
    return () => {
      current = false;
      unsubscribe();
    };
  }, []);

  return (
    <section aria-label="Recent files">
      <div className={styles.header}>
        <Subtitle2>Recent files</Subtitle2>
        {files && files.length > 0 && (
          <Button appearance="subtle" size="small" onClick={() => void clearRecent()}>
            Clear all
          </Button>
        )}
      </div>
      <Caption1 className={styles.meta}>Stored only in this browser.</Caption1>
      {files?.length === 0 && <Body1 block>No recent files yet.</Body1>}
      <ul className={styles.list}>
        {files?.map((file) => (
          <li key={file.id} className={styles.row}>
            <Button
              appearance="subtle"
              className={styles.open}
              aria-label={`Open ${file.name}`}
              onClick={() => onOpen(file)}
            >
              <span>
                <Body1 block>{file.name}</Body1>
                <Caption1 className={styles.meta}>
                  {file.format.toUpperCase()} · {formatBytes(file.size)} ·{' '}
                  {new Date(file.openedAt).toLocaleString()}
                </Caption1>
              </span>
            </Button>
            <Button
              appearance="subtle"
              icon={<DeleteRegular />}
              aria-label={`Forget ${file.name}`}
              onClick={() => void forgetRecent(file.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
