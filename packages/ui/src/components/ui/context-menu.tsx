import React from 'react';

type Props = React.PropsWithChildren<{
  className?: string;
}>;

export const ContextMenu: React.FC<Props> = ({ children }) => <>{children}</>;

export const ContextMenuTrigger: React.FC<Props> = ({ children }) => <>{children}</>;

export const ContextMenuContent: React.FC<Props> = ({ children, className }) => (
  <div className={className}>{children}</div>
);

export const ContextMenuItem: React.FC<Props & { onSelect?: () => void }> = ({ children, className, onSelect }) => (
  <button type="button" className={className} onClick={onSelect}>
    {children}
  </button>
);

