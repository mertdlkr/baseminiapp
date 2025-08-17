"use client";

import { type ReactNode } from "react";
import { base } from "wagmi/chains";
import { MiniKitProvider } from "@coinbase/onchainkit/minikit";

export function Providers(props: { children: ReactNode }) {
  return (
    <MiniKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
      chain={base}
      config={{
        appearance: {
          mode: "auto",
          theme: "mini-app-theme",
          name: "Vibe Portfolio",
          logo: process.env.NEXT_PUBLIC_ICON_URL,
        },
        metadata: {
          name: "Vibe Portfolio",
        },
      }}
    >
      {props.children}
    </MiniKitProvider>
  );
}
