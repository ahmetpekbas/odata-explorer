import {
  Button,
  Menu,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Tooltip,
} from '@fluentui/react-components';
import { DarkThemeRegular } from '@fluentui/react-icons';
import { isThemePreference, type ThemePreference } from '../../app/theme.ts';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

interface ThemeMenuProps {
  preference: ThemePreference;
  onChange: (preference: ThemePreference) => void;
}

export function ThemeMenu({ preference, onChange }: ThemeMenuProps) {
  return (
    <Menu
      checkedValues={{ theme: [preference] }}
      onCheckedValueChange={(_, { checkedItems }) => {
        const [value] = checkedItems;
        if (isThemePreference(value)) onChange(value);
      }}
    >
      <MenuTrigger disableButtonEnhancement>
        <Tooltip content="Theme" relationship="label">
          <Button appearance="subtle" icon={<DarkThemeRegular />} />
        </Tooltip>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          {OPTIONS.map(({ value, label }) => (
            <MenuItemRadio key={value} name="theme" value={value}>
              {label}
            </MenuItemRadio>
          ))}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}
