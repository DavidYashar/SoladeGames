import { createConfig } from "wagmi";

import { arcChain, arcTransport } from "./arc";

/** Shared wagmi config for the whole app. */
export const wagmiConfig = createConfig({
  chains: [arcChain],
  transports: {
    [arcChain.id]: arcTransport,
  },
  ssr: true,
});
