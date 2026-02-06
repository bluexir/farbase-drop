import { getAddress, isAddress } from "ethers";

export type Hex = `0x${string}`;
export type Address = Hex;

const HEX_RE = /^0x[0-9a-fA-F]+$/;

export function isHex(value: unknown): value is Hex {
  if (typeof value !== "string") return false;
  if (!HEX_RE.test(value)) return false;
  // Must be an even number of hex chars after 0x (bytes)
  return (value.length - 2) % 2 === 0;
}

export function assertHex(value: unknown, label = "hex"): Hex {
  if (!isHex(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

export function parseAddress(value: unknown): Address | null {
  if (typeof value !== "string") return null;
  if (!isAddress(value)) return null;
  // Normalize to checksum address; still satisfies 0x${string}
  return getAddress(value) as Address;
}

export function assertAddress(value: unknown, label = "address"): Address {
  const addr = parseAddress(value);
  if (!addr) throw new Error(`Invalid ${label}`);
  return addr;
}
