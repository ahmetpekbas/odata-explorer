import { Badge, makeStyles, tokens } from '@fluentui/react-components';
import type { Annotation } from '../../csdl/model.ts';
import { capabilitiesOf, type Capability } from '../../csdl/term-summaries.ts';

const useStyles = makeStyles({
  badges: {
    display: 'inline-flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
    verticalAlign: 'middle',
  },
});

/** The core four are always shown; the others only when the service switches them off. */
const CORE = new Set(['Insertable', 'Updatable', 'Deletable', 'Filterable']);

/** `Insertable` -> `Not insertable`. */
const negated = (label: string) => `Not ${label.toLowerCase()}`;

/** What to badge: nothing without capability annotations, else the core four plus any disabled one. */
function badgedCapabilities(annotations: readonly Annotation[]): Capability[] {
  return capabilitiesOf(annotations).filter((c) => CORE.has(c.label) || !c.enabled);
}

/** Badges for what an entity set or singleton allows: insertable, updatable, deletable, filterable. */
export function CapabilityBadges({ annotations }: { annotations: readonly Annotation[] }) {
  const styles = useStyles();
  const capabilities = badgedCapabilities(annotations);
  if (capabilities.length === 0) return null;
  return (
    <span className={styles.badges} role="list" aria-label="Capabilities">
      {capabilities.map((c) => (
        <Badge
          key={c.label}
          role="listitem"
          size="small"
          appearance={c.enabled ? 'tint' : 'filled'}
          color={c.enabled ? 'success' : 'danger'}
        >
          {c.enabled ? c.label : negated(c.label)}
        </Badge>
      ))}
    </span>
  );
}
