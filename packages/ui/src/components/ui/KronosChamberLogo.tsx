import React from 'react';
import { cn } from '@/lib/utils';
import KronosMascot from './KronosMascot'; // Correct import path

interface KronosChamberLogoProps {
  className?: string;
  width?: number;
  height?: number;
  isAnimated?: boolean;
}

export const KronosChamberLogo: React.FC<KronosChamberLogoProps> = ({
  className = '',
  width = 70,
  height = 70,
  isAnimated = false,
}) => {
  const size = Math.max(24, Math.round((width + height) / 2));

  return (
    <KronosMascot
      src={isAnimated ? undefined : '/branding/source/gemini-default.png'} // Use default mascot if not animated
      rotating={isAnimated} // Map isAnimated to rotating
      style={{ width: size, height: size }} // Map size to style
      className={cn(
        'rounded-2xl',
        className,
      )}
    />
  );
};
