import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";
import abi from "../contracts/DaanSetu.abi.json";
import deployments from "../contracts/deployments.json";
import { setChainTime } from "./format";

export const CHAINS = {
  31337: { name: "Local Hardhat", rpc: "http://127.0.0.1:8545", symbol: "ETH", explorer: "" },
  11155111: {
    name: "Sepolia testnet",
    rpc: "https://ethereum-sepolia-rpc.publicnode.com",
    symbol: "ETH",
    explorer: "https://sepolia.etherscan.io",
  },
  80002: {
    name: "Polygon Amoy testnet",
    rpc: "https://rpc-amoy.polygon.technology",
    symbol: "POL",
    explorer: "https://amoy.polygonscan.com",
  },
};

function pickChain() {
  const fromEnv = Number(import.meta.env.VITE_CHAIN_ID);
  if (fromEnv) return fromEnv;
  const deployed = Object.keys(deployments).map(Number);
  if (deployed.includes(11155111)) return 11155111;
  return deployed[0] || 11155111;
}

export const CHAIN_ID = pickChain();
export const CHAIN = CHAINS[CHAIN_ID] || { name: `Chain ${CHAIN_ID}`, rpc: "", symbol: "ETH", explorer: "" };
export const RPC_URL = import.meta.env.VITE_RPC_URL || CHAIN.rpc;
export const DEPLOYMENT = deployments[String(CHAIN_ID)] || null;
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || DEPLOYMENT?.address || "";
export const SYMBOL = CHAIN.symbol;

export const STATUS = ["Active", "Funded", "Failed", "Cancelled", "Completed"];
export const MILESTONE_STATE = ["Pending", "Voting", "Released", "Rejected"];

let readProvider;
export function getReadProvider() {
  if (!readProvider) readProvider = new JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true });
  return readProvider;
}

export function getReadContract() {
  return new Contract(CONTRACT_ADDRESS, abi, getReadProvider());
}

export function hasWallet() {
  return typeof window !== "undefined" && !!window.ethereum;
}

export async function getWriteContract() {
  if (!hasWallet()) throw new Error("No wallet found. Install MetaMask to continue.");
  await ensureChain();
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return new Contract(CONTRACT_ADDRESS, abi, signer);
}

export async function ensureChain() {
  const hex = "0x" + CHAIN_ID.toString(16);
  const current = await window.ethereum.request({ method: "eth_chainId" });
  if (parseInt(current, 16) === CHAIN_ID) return;
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (err) {
    if (err?.code !== 4902) throw err;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hex,
          chainName: CHAIN.name,
          rpcUrls: [RPC_URL],
          nativeCurrency: { name: CHAIN.symbol, symbol: CHAIN.symbol, decimals: 18 },
          blockExplorerUrls: CHAIN.explorer ? [CHAIN.explorer] : [],
        },
      ],
    });
  }
}

export function explorerAddress(addr) {
  return CHAIN.explorer ? `${CHAIN.explorer}/address/${addr}` : "";
}
export function explorerTx(hash) {
  return CHAIN.explorer ? `${CHAIN.explorer}/tx/${hash}` : "";
}

// ---- reading & normalising contract data ---------------------------------

const n = (v) => Number(v);

export function toCampaign(id, raw, status) {
  return {
    id: Number(id),
    creator: raw.creator,
    title: raw.title,
    story: raw.story,
    category: raw.category,
    imageUrl: raw.imageUrl,
    goal: raw.goal,
    raised: raw.raised,
    released: raw.released,
    refundPool: raw.refundPool,
    deadline: n(raw.deadline),
    createdAt: n(raw.createdAt),
    lastActivity: n(raw.lastActivity),
    currentMilestone: n(raw.currentMilestone),
    milestoneCount: n(raw.milestoneCount),
    rejections: n(raw.rejections),
    cancelled: raw.cancelled,
    donorCount: n(raw.donorCount),
    status: STATUS[n(status)],
  };
}

async function syncClock() {
  try {
    const b = await getReadProvider().getBlock("latest");
    if (b) setChainTime(b.timestamp);
  } catch {
    /* keep device time */
  }
}

export async function fetchAllCampaigns() {
  const c = getReadContract();
  await syncClock();
  const count = Number(await c.campaignCount());
  const ids = [...Array(count).keys()];
  return Promise.all(
    ids.map(async (id) => {
      const [raw, st, ms] = await Promise.all([c.getCampaign(id), c.status(id), c.getMilestones(id)]);
      return { ...toCampaign(id, raw, st), milestones: ms.map(toMilestone) };
    }),
  );
}

export function toMilestone(m) {
  return {
    title: m.title,
    amount: m.amount,
    state: MILESTONE_STATE[n(m.state)],
    voteEnd: n(m.voteEnd),
    yesWeight: m.yesWeight,
    noWeight: m.noWeight,
    round: n(m.round),
  };
}

export async function fetchCampaign(id, account) {
  const c = getReadContract();
  await syncClock();
  const [raw, st, ms, ups, donations, platform] = await Promise.all([
    c.getCampaign(id),
    c.status(id),
    c.getMilestones(id),
    c.getUpdates(id),
    c.getDonations(id, 0, 100),
    Promise.all([c.votingPeriod(), c.inactivityPeriod()]),
  ]);
  let me = null;
  if (account) {
    const [contribution, refundable, voted] = await Promise.all([
      c.contributionOf(id, account),
      c.refundableOf(id, account),
      c.hasVoted(id, account),
    ]);
    me = { contribution, refundable, voted };
  }
  return {
    ...toCampaign(id, raw, st),
    milestones: ms.map(toMilestone),
    updates: ups.map((u) => ({ text: u.text, time: n(u.time) })).reverse(),
    donations: donations.map((d) => ({ donor: d.donor, amount: d.amount, time: n(d.time), note: d.note })),
    votingPeriod: n(platform[0]),
    inactivityPeriod: n(platform[1]),
    me,
  };
}

export async function fetchTotals() {
  const c = getReadContract();
  const [total, count] = await Promise.all([c.totalRaisedAllTime(), c.campaignCount()]);
  return { total, count: Number(count) };
}

// Turn ethers / wallet errors into a sentence a donor can act on.
export function friendlyError(err) {
  if (!err) return "Something went wrong.";
  if (err.code === "ACTION_REJECTED" || err.code === 4001 || err?.info?.error?.code === 4001)
    return "You cancelled the request in your wallet.";
  const reason = err.revert?.args?.[0] || err.reason;
  if (reason) return capitalise(String(reason)) + ".";
  if (/insufficient funds/i.test(err.message || "")) return "Your wallet doesn't have enough balance for this plus gas.";
  if (err.revert?.name === "NotCreator") return "Only the campaign creator can do this.";
  const msg = err.shortMessage || err.message || String(err);
  return msg.length > 160 ? msg.slice(0, 160) + "…" : msg;
}

function capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
