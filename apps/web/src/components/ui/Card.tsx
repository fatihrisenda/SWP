import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  as?: 'div' | 'section' | 'article' | 'li';
  ariaLabel?: string;
}

export function Card({ children, as = 'div', className = '', ariaLabel, ...rest }: CardProps) {
  // Keempat tag menerima atribut yang sama; TS memilih `li` (paling sempit) untuk union literal.
  const Tag = as as 'div';
  return (
    <Tag aria-label={ariaLabel} className={`card p-4 ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
