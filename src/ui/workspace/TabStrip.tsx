import type { MouseEvent } from 'react';
import {
  Button,
  makeStyles,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  mergeClasses,
  Overflow,
  OverflowItem,
  Tab,
  TabList,
  tokens,
  useIsOverflowItemVisible,
  useOverflowMenu,
} from '@fluentui/react-components';
import { DismissRegular, MoreHorizontalRegular } from '@fluentui/react-icons';
import type { Tab as TabState } from '../../app/store.ts';
import { tabLabel } from '../../app/tab-label.ts';

const useStyles = makeStyles({
  strip: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  item: { display: 'flex', alignItems: 'center', flexShrink: 0 },
  preview: { fontStyle: 'italic' },
  close: { marginInlineStart: `calc(${tokens.spacingHorizontalXS} * -1)` },
});

interface TabStripProps {
  tabs: TabState[];
  activeTab: string | undefined;
  onActivate: (id: string) => void;
  onPin: (id: string) => void;
  onClose: (id: string) => void;
  onCloseOthers: (id: string) => void;
}

export function TabStrip({
  tabs,
  activeTab,
  onActivate,
  onPin,
  onClose,
  onCloseOthers,
}: TabStripProps) {
  const styles = useStyles();

  return (
    <Overflow minimumVisible={1}>
      <div className={styles.strip}>
        <TabList
          selectedValue={activeTab ?? false}
          onTabSelect={(_, data) => onActivate(String(data.value))}
          style={{ minWidth: 0, flex: '0 1 auto', overflow: 'hidden' }}
        >
          {tabs.map((tab) => (
            <OverflowItem key={tab.id} id={tab.id} priority={tab.id === activeTab ? 1 : 0}>
              <div className={styles.item}>
                <Menu openOnContext>
                  <MenuTrigger disableButtonEnhancement>
                    <Tab
                      value={tab.id}
                      title={tab.id}
                      className={mergeClasses(!tab.pinned && styles.preview)}
                      onDoubleClick={() => onPin(tab.id)}
                      onMouseDown={(event: MouseEvent) =>
                        event.button === 1 && event.preventDefault()
                      }
                      onAuxClick={(event: MouseEvent) => event.button === 1 && onClose(tab.id)}
                    >
                      {tabLabel(tab)}
                    </Tab>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem onClick={() => onClose(tab.id)}>Close</MenuItem>
                      <MenuItem disabled={tabs.length < 2} onClick={() => onCloseOthers(tab.id)}>
                        Close others
                      </MenuItem>
                      <MenuItem disabled={tab.pinned} onClick={() => onPin(tab.id)}>
                        Keep open
                      </MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
                <Button
                  className={styles.close}
                  appearance="subtle"
                  size="small"
                  icon={<DismissRegular />}
                  aria-label={`Close ${tabLabel(tab)}`}
                  onClick={() => onClose(tab.id)}
                />
              </div>
            </OverflowItem>
          ))}
        </TabList>
        <OverflowMenu tabs={tabs} onActivate={onActivate} />
      </div>
    </Overflow>
  );
}

function OverflowMenu({ tabs, onActivate }: Pick<TabStripProps, 'tabs' | 'onActivate'>) {
  const { ref, isOverflowing, overflowCount } = useOverflowMenu<HTMLButtonElement>();
  if (!isOverflowing) return null;
  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <MenuButton
          ref={ref}
          appearance="subtle"
          size="small"
          icon={<MoreHorizontalRegular />}
          aria-label={`${overflowCount} more tabs`}
        />
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          {tabs.map((tab) => (
            <OverflowMenuItem key={tab.id} tab={tab} onActivate={onActivate} />
          ))}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}

function OverflowMenuItem({
  tab,
  onActivate,
}: {
  tab: TabState;
  onActivate: (id: string) => void;
}) {
  // Tabs that fit are in the strip already.
  if (useIsOverflowItemVisible(tab.id)) return null;
  return <MenuItem onClick={() => onActivate(tab.id)}>{tabLabel(tab)}</MenuItem>;
}
