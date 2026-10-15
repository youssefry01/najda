"use client";

import { QueryProvider } from "@/components/Providers/query-provider";
import { AuthListener } from "@/components/Providers/auth-listener";
import { PushSync } from "@/components/Providers/push-sync";
import { ThemeProvider } from "next-themes";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
    >
        <QueryProvider>
        <AuthListener />
        <PushSync />
        {children}
        </QueryProvider>
    </ThemeProvider>
  );
}