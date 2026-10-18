import { formatEther } from "ethers";
import { SYMBOL } from "./chain";

// Offset between the blockchain's clock and this device's clock, in seconds.
// Deadlines and vote windows are judged by block time, so countdowns use it too.
let clockOffset = 0;
export function setChainTime(blockTimestamp) {
  clockOffset = Number(blockTimestamp) - Math.floor(Date.now() / 1000);
}
export function nowSec() {
  return Math.floor(Date.now() / 1000) + clockOffset;
}

export function eth(wei, digits = 4) {
  const v = Number(formatEther(wei ?? 0n));
  if (v === 0) return `0 ${SYMBOL}`;
  const s = v < 0.0001 ? "<0.0001" : v.toLocaleString("en-IN", { maximumFractionDigits: digits });
  return `${s} ${SYMBOL}`;
}

export function ethNum(wei, digits = 4) {
  return Number(formatEther(wei ?? 0n)).toLocaleString("en-IN", { maximumFractionDigits: digits });
}

export function short(addr) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

export function pct(part, whole) {
  if (!whole || whole === 0n) return 0;
  return Math.min(100, Number((BigInt(part) * 10000n) / BigInt(whole)) / 100);
}

export function timeLeft(unixSeconds) {
  const diff = unixSeconds - nowSec();
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d} day${d === 1 ? "" : "s"}${h ? ` ${h} hr` : ""}`;
  if (h > 0) return `${h} hr ${m} min`;
  return `${Math.max(1, m)} min`;
}

export function dateStr(unixSeconds) {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function dateTimeStr(unixSeconds) {
  return new Date(unixSeconds * 1000).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function sameAddr(a, b) {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}
