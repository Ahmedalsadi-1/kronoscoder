// packages/ui/src/components/chat/runtime/FloatingRuntimeWidget.tsx
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import KronosMascot from '@/components/ui/KronosMascot';
import { MASCOT_COLLAGE_A } from '@/lib/branding/mascotFrames';

interface FloatingRuntimeWidgetProps {
  isVisible: boolean;
  isBrowserTabActive: boolean;
  isExpanded: boolean; // Indicates if the side panel is open
  onExpand: () => void;
  onDismiss: () => void;
  // TODO: Add runtime status, live URL, etc.
}

export const FloatingRuntimeWidget: React.FC<FloatingRuntimeWidgetProps> = ({
  isVisible,
  isBrowserTabActive,
  isExpanded,
  onExpand,
  onDismiss,
}) => {
  if (!isVisible || isExpanded) {
    return null; // Don't render if not visible or already expanded to side panel
  }

  // Placement logic based on the spec
  const positionClasses = isBrowserTabActive
    ? 'bottom-4 right-4' // Browser tab open: bottom-right over chat area
    : 'bottom-20 left-1/2 -translate-x-1/2'; // Chat-only: centered above chat input area (adjust bottom for input height)

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'fixed z-50 p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full shadow-lg backdrop-blur-md cursor-pointer',
            'border border-blue-400/30 hover:border-blue-400/50 transition-all duration-200 ease-in-out',
            positionClasses
          )}
          onClick={onExpand}
          // Optionally add a dismiss button if needed, but for now, clicking expands
        >
          <div className="relative w-16 h-16 flex items-center justify-center">
            {/* Mascot rotating in loading/runtime surfaces */}
            <KronosMascot src={MASCOT_COLLAGE_A} rotating={true} rotationInterval={150} className="w-14 h-14 rounded-full" />
            <span className="absolute top-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></span>
            {/* TODO: Add more detailed status/indicator */}
          </div>
          {/* TODO: Add a tooltip or small text indicating "Runtime Active" */}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FloatingRuntimeWidget;
