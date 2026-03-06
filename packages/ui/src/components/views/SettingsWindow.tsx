import React from 'react';
import { cn } from '@/lib/utils';
import { SettingsView } from './SettingsView';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SettingsWindowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Settings rendered as a centered window with blurred backdrop.
 * Used for desktop and web (non-mobile) environments.
 */
export const SettingsWindow: React.FC<SettingsWindowProps> = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        fallbackTitle="KronosChamber settings"
        fallbackDescription="KronosChamber settings window."
        className={cn(
          'z-50 w-[90vw] max-w-[1200px] h-[85vh] max-h-[900px] rounded-xl border shadow-2xl',
          'overflow-hidden bg-background'
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>KronosChamber settings</DialogTitle>
          <DialogDescription>KronosChamber settings window.</DialogDescription>
        </DialogHeader>
          <SettingsView onClose={() => onOpenChange(false)} isWindowed />
      </DialogContent>
    </Dialog>
  );
};
