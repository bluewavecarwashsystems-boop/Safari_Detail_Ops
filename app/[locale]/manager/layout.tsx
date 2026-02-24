import { ReactNode } from 'react';

interface ManagerRouteLayoutProps {
  children: ReactNode;
}

/**
 * Layout for all /manager/* routes
 * Note: Individual pages within manager routes will use ManagerLayout component
 * to provide consistent headers. This layout just passes through children.
 */
export default function ManagerRouteLayout({ children }: ManagerRouteLayoutProps) {
  return <>{children}</>;
}
