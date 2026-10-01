import type { ReactNode } from 'react';
import { Link } from '@fluentui/react-components';
import { useStore } from '../../app/store.ts';
import { openableTarget } from '../../app/openable.ts';
import type { Resolved } from '../../csdl/resolve.ts';

interface ElementLinkProps {
  resolved: Resolved;
  /** Target-path ID of the element to open. */
  id: string;
  children: ReactNode;
}

/** Opens the element in a tab. Text only when nothing in the model matches `id`. */
export function ElementLink({ resolved, id, children }: ElementLinkProps) {
  const openTab = useStore((s) => s.openTab);
  const target = openableTarget(resolved, id);
  if (!target) return <>{children}</>;
  return (
    <Link as="button" onClick={() => openTab(target)}>
      {children}
    </Link>
  );
}
