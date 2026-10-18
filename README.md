# DaanSetu

Crowdfunding for social causes where donations are held in a smart-contract escrow and released milestone by milestone, only when donors don't object.

**The problem:** on normal crowdfunding sites, once you donate, the money goes straight to the organiser and you have no say in how it is used. If the goal is missed, refunds depend on the platform's goodwill.

**What DaanSetu does differently:**

| | Typical crowdfunding | DaanSetu |
|---|---|---|
| Where the money sits | Organiser's or platform's bank account | A public smart contract nobody can move money out of by hand |
| When the organiser gets it | Immediately | One milestone at a time, after a donor vote |
| Goal missed | Depends on platform policy | Every donor can claim a full refund, enforced by code |
| Organiser disappears | Money is gone | Donors cancel after 30 days of silence and get back what's left |
| Proof of use | Whatever the organiser posts | On-chain donation ledger + timestamped creator updates |
| Login | Email + password + database | Your crypto wallet (MetaMask); no passwords stored anywhere |
| Platform fee | Usually 2–8% | None, only network gas |

## How it works

1. A creator splits the goal into up to 5 milestones (e.g. "buy materials", "build", "training"). The goal is the sum of milestones.
2. Donors give; money stays in the contract. Donations are capped at the remaining goal.
3. If the deadline passes before the goal is reached, the campaign is **Failed** and each donor can claim a full refund.
4. Once fully funded, the creator requests release of the next milestone. Donors vote during a voting window, weighted by how much they gave. The release passes unless *block* weight exceeds *approve* weight (silence counts as consent, so a creator isn't stuck when donors don't vote).
5. If donors block a release twice, the campaign is cancelled and the remaining escrow is shared back to donors pro-rata.
6. The creator can cancel at any time; donors can cancel a funded campaign whose creator has been inactive for the inactivity period (30 days by default).

## Tech stack

- **Smart contract:** Solidity 0.8.24, Hardhat (`contracts-hh/`)
- **Frontend:** React 18 + Vite + ethers.js v6 (`web/`), no backend or database
- **Networks:** Sepolia testnet (default), Polygon Amoy, or a local Hardhat chain
- **Hosting:** any static host: GitHub Pages (workflow included), Vercel or Netlify

```
daansetu/
├── contracts-hh/
│   ├── contracts/DaanSetu.sol     the escrow contract
│   ├── test/DaanSetu.test.js      10 unit tests
│   └── scripts/deploy.js, seed.js
├── web/
│   └── src/
│       ├── lib/        chain.js (contract access), wallet.jsx (MetaMask + tx toasts)
│       ├── components/ Setu (milestone bridge), CampaignCard, Cover, Header
│       └── pages/      Home, Campaign, Create, Mine (My giving), How
└── .github/workflows/pages.yml    auto-deploy to GitHub Pages
```

## Run it on your laptop (local blockchain)

Needs Node.js 18+.

```bash
# terminal 1: local blockchain with 20 funded test accounts
cd contracts-hh
npm install
npm test                 # runs the 10 contract tests
npx hardhat node

# terminal 2: deploy + sample data (300 s voting window for quick demos)
cd contracts-hh
VOTING_PERIOD_SECONDS=300 npm run deploy:local
npm run seed:local

# terminal 3: website
cd web
npm install
VITE_CHAIN_ID=31337 npm run dev      # open http://localhost:5173
```

In MetaMask, add network *Localhost 8545* (RPC `http://127.0.0.1:8545`, chain ID `31337`) and import one of the private keys that `npx hardhat node` prints. Those keys are public test keys; never send real money to them.

On Windows PowerShell, set env vars like this: `$env:VOTING_PERIOD_SECONDS=300; npm run deploy:local`.

## Put it live (Sepolia testnet + GitHub Pages)

### 1. Deploy the contract to Sepolia

1. Install MetaMask, create a **separate test account** for this project, and switch to the *Sepolia* network (Settings → Advanced → Show test networks).
2. Get free Sepolia ETH from a faucet (e.g. Google Cloud Web3 faucet, Alchemy or Infura Sepolia faucet). 0.05 ETH is plenty.
3. Export that test account's private key (MetaMask → account details → Show private key).
4. In `contracts-hh/`, copy `.env.example` to `.env` and paste the key into `PRIVATE_KEY=`. `.env` is git-ignored; never commit it or share it.
5. Deploy and (optionally) add sample campaigns:

   ```bash
   cd contracts-hh
   npm run deploy:sepolia      # writes the address into web/src/contracts/deployments.json
   npm run seed:sepolia        # optional: 4 sample campaigns
   ```

   For a viva or demo, keep `VOTING_PERIOD_SECONDS=300` in `.env` so a release vote ends in 5 minutes. For real use, remove it (default 3 days) and redeploy.

### 2. Host the website

**GitHub Pages (free, workflow included)**

1. Create a new GitHub repo (e.g. `daansetu`) and push this whole folder, including the updated `web/src/contracts/deployments.json`.
2. Repo → Settings → Pages → Source: **GitHub Actions**.
3. Every push to `main` builds `web/` and publishes it at `https://<username>.github.io/daansetu/`.

**Vercel (alternative)**: import the repo, set *Root Directory* to `web`, framework *Vite*, and deploy.

You can also skip the `deployments.json` step and set environment variables on the host instead: `VITE_CONTRACT_ADDRESS=0x…` and `VITE_CHAIN_ID=11155111`.

## Contract reference

| Function | Who | What |
|---|---|---|
| `createCampaign(title, story, category, imageUrl, deadline, milestoneTitles[], milestoneAmounts[])` | anyone | Goal = sum of milestones, 1–5 milestones, deadline ≤ 180 days |
| `donate(id, note)` payable | anyone | Only while Active; capped at remaining goal |
| `requestRelease(id)` | creator | Opens a vote on the next milestone (only when fully funded) |
| `vote(id, approve)` | donors | Weight = amount donated; one vote per round |
| `finalizeVote(id)` | anyone | After the window: releases funds, or records a block |
| `postUpdate(id, text)` | creator | Public, timestamped progress note |
| `cancel(id)` | creator | Unlocks refunds of what's still in escrow |
| `cancelForInactivity(id)` | donors | After the inactivity period with no creator activity |
| `claimRefund(id)` | donors | Full refund if Failed; pro-rata share if Cancelled |

Statuses: `Active` → `Funded` → `Completed`, or `Failed` (deadline missed) / `Cancelled`.

## Testing

- `contracts-hh`: `npm test` covers creation rules, escrow and goal cap, refunds on failure, release after vote, weighted blocking, double-rejection cancellation with pro-rata refunds, completion, creator and inactivity cancellation, and updates.
- The web app was tested end to end in a headless browser against a local chain: browsing, filters, voting, closing a vote, creating a campaign, posting updates, donating, refunds and mobile layout.

## Limitations and next steps

- Test networks only; nothing here has been audited for real money.
- Campaign text lives on-chain (simple, but gas grows with story length). Moving story and images to IPFS would cut costs.
- No identity verification of creators. A KYC badge or NGO registration check (e.g. Darpan ID) could be added off-chain.
- Prices are shown in ETH; an INR estimate via a price oracle would help donors.

## License

MIT
