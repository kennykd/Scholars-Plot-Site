"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider 
      attribute="data-theme" 
      defaultTheme="blueprint" 
      enableSystem={false}
    >
      {/* If you have an AuthProvider or other wrappers, they can go here too */}
      {children}
    </ThemeProvider>
  );
}