export const portfolioRegistryAbi = [
  {
    type: "function",
    name: "set",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assetId", type: "bytes32" },
      { name: "amount", type: "uint128" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setMany",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assetIds", type: "bytes32[]" },
      { name: "amounts", type: "uint128[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getMany",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "assetIds", type: "bytes32[]" },
    ],
    outputs: [{ name: "amounts", type: "uint128[]" }],
  },
] as const;

// Replace with your deployed address on Base once deployed
export const portfolioRegistryAddress = (process.env.NEXT_PUBLIC_PORTFOLIO_REGISTRY_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;


