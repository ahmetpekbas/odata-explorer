import { Button, Tooltip } from '@fluentui/react-components';
import { DesktopRegular, WeatherMoonRegular, WeatherSunnyRegular } from '@fluentui/react-icons';
import type { ThemePreference } from '../../app/theme.ts';

const MODES: { value: ThemePreference; label: string; icon: React.ReactElement }[] = [
  { value: 'system', label: 'System', icon: <DesktopRegular /> },
  { value: 'light', label: 'Light', icon: <WeatherSunnyRegular /> },
  { value: 'dark', label: 'Dark', icon: <WeatherMoonRegular /> },
];

interface ThemeToggleProps {
  preference: ThemePreference;
  onChange: (preference: ThemePreference) => void;
}

/** One button that steps through system, light and dark, and shows the current mode. */
export function ThemeToggle({ preference, onChange }: ThemeToggleProps) {
  const index = Math.max(
    0,
    MODES.findIndex((mode) => mode.value === preference),
  );
  const current = MODES[index]!;
  const next = MODES[(index + 1) % MODES.length]!;
  return (
    <Tooltip content={`Theme: ${current.label} (switch to ${next.label})`} relationship="label">
      <Button appearance="subtle" icon={current.icon} onClick={() => onChange(next.value)} />
    </Tooltip>
  );
}
