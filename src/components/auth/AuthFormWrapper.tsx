'use client';

import type { ReactNode } from "react";

type AuthFormWrapperProps = {
  children: ReactNode;
  className?: string;
};

export function AuthFormWrapper({ children, className }: AuthFormWrapperProps) {
  return (
    <div className={`space-y-6 ${className ?? ""}`.trim()}>
      {children}
    </div>
  );
}
