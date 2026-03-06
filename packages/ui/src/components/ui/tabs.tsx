import React, { createContext, useContext } from 'react';
import { cn } from '@/lib/utils';

type TabsContextValue = {
  value?: string;
  onValueChange?: (value: string) => void;
};

const TabsContext = createContext<TabsContextValue>({});

type TabsProps = React.PropsWithChildren<{
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}>;

export const Tabs: React.FC<TabsProps> = ({ value, onValueChange, className, children }) => (
  <TabsContext.Provider value={{ value, onValueChange }}>
    <div className={className}>{children}</div>
  </TabsContext.Provider>
);

export const TabsList: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className, children }) => (
  <div className={className}>{children}</div>
);

type TabsTriggerProps = React.PropsWithChildren<{
  value: string;
  disabled?: boolean;
  className?: string;
}>;

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ value, disabled, className, children }) => {
  const { value: active, onValueChange } = useContext(TabsContext);
  const selected = active === value;
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(className, selected && 'data-[selected=true]:font-medium')}
      data-selected={selected}
      onClick={() => onValueChange?.(value)}
    >
      {children}
    </button>
  );
};

type TabsContentProps = React.PropsWithChildren<{
  value: string;
  className?: string;
}>;

export const TabsContent: React.FC<TabsContentProps> = ({ value, className, children }) => {
  const { value: active } = useContext(TabsContext);
  if (active !== value) return null;
  return <div className={className}>{children}</div>;
};

