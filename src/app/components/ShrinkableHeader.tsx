'use client';

import { ReactNode } from 'react';

interface ShrinkableHeaderProps {
  children: ReactNode;
  className?: string;
}

export default function ShrinkableHeader({
  children,
  className = '',
}: ShrinkableHeaderProps) {
  return (
    <div className={`sticky-header-container ${className}`}>
      {children}
    </div>
  );
}
