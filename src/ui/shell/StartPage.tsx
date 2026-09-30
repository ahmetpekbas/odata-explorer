import { useRef, useState, type DragEvent } from 'react';
import {
  Body1,
  Button,
  Caption1,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  mergeClasses,
  shorthands,
  ProgressBar,
  Subtitle1,
  tokens,
} from '@fluentui/react-components';
import { DocumentArrowUpRegular } from '@fluentui/react-icons';
import type { AppDocument } from '../../app/store.ts';
import { countElements } from '../../app/summary.ts';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    width: 'min(40rem, 100%)',
  },
  dropZone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalXXL,
    border: `${tokens.strokeWidthThick} dashed ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusXLarge,
    textAlign: 'center',
  },
  dragging: {
    ...shorthands.borderColor(tokens.colorBrandStroke1),
    backgroundColor: tokens.colorBrandBackground2,
  },
  icon: { fontSize: '48px', color: tokens.colorNeutralForeground3 },
  counts: { display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalL },
});

interface StartPageProps {
  /** The document to report on, if one was opened. */
  document: AppDocument | undefined;
  onOpen: (file: File) => void;
}

export function StartPage({ document, onOpen }: StartPageProps) {
  const styles = useStyles();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onOpen(file);
  };

  return (
    <div className={styles.root}>
      <div
        className={mergeClasses(styles.dropZone, dragging && styles.dragging)}
        data-testid="drop-zone"
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <DocumentArrowUpRegular className={styles.icon} aria-hidden />
        <Subtitle1>Drop an OData $metadata file here</Subtitle1>
        <Body1>CSDL XML or CSDL JSON, OData v4. The file stays in your browser.</Body1>
        <Button appearance="primary" onClick={() => input.current?.click()}>
          Choose a file
        </Button>
        <input
          ref={input}
          type="file"
          hidden
          aria-label="Choose a metadata file"
          accept=".xml,.json,.csdl,text/xml,application/xml,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onOpen(file);
            // Choosing the same file again has to fire another change event.
            event.target.value = '';
          }}
        />
      </div>
      {document && <Status document={document} />}
    </div>
  );
}

function Status({ document }: { document: AppDocument }) {
  const styles = useStyles();
  switch (document.status) {
    case 'loading': {
      const { progress } = document;
      return (
        <div>
          <Caption1>
            {progress?.stage === 'resolving' ? 'Resolving' : 'Reading'} {document.name}…
          </Caption1>
          <ProgressBar value={progress ? progress.done / Math.max(progress.total, 1) : undefined} />
        </div>
      );
    }
    case 'error':
      return (
        <MessageBar intent="error">
          <MessageBarBody>
            <MessageBarTitle>Could not open {document.name}</MessageBarTitle>
            {document.error}
          </MessageBarBody>
        </MessageBar>
      );
    case 'ready': {
      const counts = countElements(document.resolved);
      return (
        <MessageBar intent="success">
          <MessageBarBody>
            <MessageBarTitle>Loaded {document.name}</MessageBarTitle>
            <span className={styles.counts}>
              <span>{counts.entityTypes} entity types</span>
              <span>{counts.complexTypes} complex types</span>
              <span>{counts.enumTypes} enum types</span>
              <span>{counts.entitySets} entity sets</span>
              <span>{counts.singletons} singletons</span>
            </span>
          </MessageBarBody>
        </MessageBar>
      );
    }
  }
}
