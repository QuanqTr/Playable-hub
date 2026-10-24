import type { Network } from "@/lib/types";

export function NetworkTag({ network }: { network: Network }) {
  const unity = network.name.trim().toLowerCase() === "unity ads" || network.id === "unity-ads";
  return <span className={`network-chip${unity ? " network-unity" : ""}`}>{network.name}</span>;
}
