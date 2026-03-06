import React from 'react';
import { cn } from '@/lib/utils';

type CodeBlockProps = {
  code: string;
  language?: string;
  className?: string;
};

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, className }) => {
  return (
    <pre className={cn('overflow-x-auto rounded-md border border-border/50 bg-muted/20 p-3', className)}>
      <code>{code}</code>
    </pre>
  );
};

