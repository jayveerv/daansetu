import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CampaignCard from "../components/CampaignCard";
import Setu from "../components/Setu";
import { CATEGORIES } from "../lib/categories";
import { fetchAllCampaigns, fetchTotals, CHAIN } from "../lib/chain";
import { eth, pct } from "../lib/format";
import { useLoader } from "../lib/wallet";

const SORTS = {
  newest: (a, b) => b.createdAt - a.createdAt,
  closing: (a, b) => a.deadline - b.deadline,
  nearly: (a, b) => pct(b.raised, b.goal) - pct(a.raised, a.goal),
};

export default function Home() {
  const { data, loading, error } = useLoader(() => Promise.all([fetchAllCampaigns(), fetchTotals()]), []);
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  const [showClosed, setShowClosed] = useState(false);

  const campaigns = data?.[0] || [];
  const totals = data?.[1];
  const released = campaigns.reduce((s, c) => s + c.released, 0n);

  const featured = useMemo(() => {
    const live = campaigns.filter((c) => c.status === "Active" || c.status === "Funded");
    return live.sort((a, b) => (b.raised > a.raised ? 1 : -1))[0];
  }, [campaigns]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return campaigns
      .filter((c) => cat === "All" || c.category === cat)
      .filter((c) => showClosed || c.status === "Active" || c.status === "Funded")
      .filter((c) => !term || c.title.toLowerCase().includes(term) || c.story.toLowerCase().includes(term))
      .sort(SORTS[sort]);
  }, [campaigns, cat, q, sort, showClosed]);

  return (
    <>
      <section className="hero wrap">
        <div className="hero__text">
          <h1>
            Give to a cause.
            <br />
            The money moves only when the work does.
          </h1>
          <p className="lede">
            On DaanSetu everything you give is held by a public smart contract. Creators unlock it one milestone at
            a time, and donors can block a release they don't believe in. Miss the goal, and you take your money back.
          </p>
          <div className="hero__cta">
            <a href="#causes" className="btn btn--haldi">
              Browse causes
            </a>
            <Link to="/start" className="btn btn--line">
              Start a campaign
            </Link>
          </div>
        </div>

        <figure className="hero__setu">
          {featured ? (
            <>
              <figcaption>
                <Link to={`/campaign/${featured.id}`}>{featured.title}</Link>
                <span className="muted">
                  {eth(featured.raised)} of {eth(featured.goal)} raised
                </span>
              </figcaption>
              <Setu c={featured} />
            </>
          ) : (
            <>
              <figcaption>
                <span>How a campaign's money is split</span>
                <span className="muted">Example: a 1.5 {"ETH"} goal in three milestones</span>
              </figcaption>
              <Setu c={DEMO} />
            </>
          )}
        </figure>
      </section>

      {totals && (
        <p className="ledger-line wrap">
          {eth(totals.total, 3)} given across {totals.count} campaign{totals.count === 1 ? "" : "s"} on {CHAIN.name}.{" "}
          {eth(released, 3)} of it released after donors had their say.
        </p>
      )}

      <section id="causes" className="wrap causes">
        <div className="causes__head">
          <h2>Causes</h2>
          <div className="causes__tools">
            <input
              type="search"
              placeholder="Search causes"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search causes"
            />
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
              <option value="newest">Newest</option>
              <option value="closing">Closing soon</option>
              <option value="nearly">Nearly funded</option>
            </select>
          </div>
        </div>
        <div className="chips" role="tablist" aria-label="Filter by cause">
          {["All", ...CATEGORIES.map((c) => c.name)].map((name) => (
            <button
              key={name}
              role="tab"
              aria-selected={cat === name}
              className={`chip ${cat === name ? "chip--on" : ""}`}
              onClick={() => setCat(name)}
            >
              {name}
            </button>
          ))}
          <label className="chip chip--toggle">
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Show closed
          </label>
        </div>

        {error && <SetupNotice error={error} />}
        {loading && !data && <p className="muted pad">Reading campaigns from the blockchain…</p>}
        {data && list.length === 0 && (
          <div className="empty">
            <p>
              {campaigns.length === 0
                ? "No campaigns yet. Be the first to raise for a cause."
                : "Nothing matches these filters. Try another cause or turn on closed campaigns."}
            </p>
            {campaigns.length === 0 && (
              <Link to="/start" className="btn btn--ink">
                Start a campaign
              </Link>
            )}
          </div>
        )}
        <div className="grid">
          {list.map((c) => (
            <CampaignCard key={c.id} c={c} />
          ))}
        </div>
      </section>
    </>
  );
}

export function SetupNotice({ error }) {
  return (
    <div className="notice notice--warn">
      <strong>Can't read the DaanSetu contract.</strong>
      <p>
        Either the contract isn't deployed on {CHAIN.name} yet, or the network is unreachable. Deploy it with{" "}
        <code>npm run deploy:sepolia</code> in <code>contracts-hh</code>, then rebuild this site.
      </p>
      <p className="muted small">{String(error?.shortMessage || error?.message || error).slice(0, 200)}</p>
    </div>
  );
}

const E = (x) => BigInt(Math.round(x * 1e6)) * 10n ** 12n;
const DEMO = {
  goal: E(1.5),
  raised: E(1.5),
  cancelled: false,
  status: "Funded",
  currentMilestone: 1,
  milestones: [
    { title: "Buy materials", amount: E(0.5), state: "Released" },
    { title: "Build and install", amount: E(0.6), state: "Voting", voteEnd: Math.floor(Date.now() / 1000) + 2 * 86400 },
    { title: "Training and handover", amount: E(0.4), state: "Pending" },
  ],
};
