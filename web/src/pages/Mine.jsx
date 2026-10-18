import { Link } from "react-router-dom";
import CampaignCard from "../components/CampaignCard";
import { fetchAllCampaigns, getReadContract } from "../lib/chain";
import { eth, nowSec, sameAddr } from "../lib/format";
import { useLoader, useWallet } from "../lib/wallet";

async function loadMine(account) {
  const all = await fetchAllCampaigns();
  const c = getReadContract();
  const mine = all.filter((x) => sameAddr(x.creator, account));
  const gave = await Promise.all(
    all.map(async (x) => {
      const [given, refundable, voted] = await Promise.all([c.contributionOf(x.id, account), c.refundableOf(x.id, account), c.hasVoted(x.id, account)]);
      return { ...x, given, refundable, voted };
    }),
  );
  return { mine, gave: gave.filter((x) => x.given > 0n) };
}

export default function Mine() {
  const { account, connect } = useWallet();
  const { data, loading } = useLoader(() => (account ? loadMine(account) : Promise.resolve(null)), [account]);

  if (!account) {
    return (
      <div className="wrap pad empty">
        <h1>My giving</h1>
        <p>Connect your wallet to see the campaigns you've started and the ones you've given to.</p>
        <button className="btn btn--ink" onClick={connect}>
          Connect wallet
        </button>
      </div>
    );
  }
  if (loading && !data) return <p className="wrap pad muted">Loading…</p>;

  const total = data.gave.reduce((s, x) => s + x.given, 0n);
  const actions = data.gave.filter(
    (x) => x.refundable > 0n || (!x.voted && x.milestones[x.currentMilestone]?.state === "Voting" && x.milestones[x.currentMilestone].voteEnd > nowSec()),
  );

  return (
    <div className="wrap mine">
      <h1>My giving</h1>
      <p className="lede">
        {data.gave.length
          ? `You've given ${eth(total)} to ${data.gave.length} campaign${data.gave.length === 1 ? "" : "s"}.`
          : "You haven't donated yet."}
      </p>

      {actions.length > 0 && (
        <section className="panel panel--vote">
          <h2>Needs your attention</h2>
          <ul className="todo">
            {actions.map((x) => (
              <li key={x.id}>
                <Link to={`/campaign/${x.id}`}>{x.title}</Link>
                <span>{x.refundable > 0n ? `Refund of ${eth(x.refundable)} waiting` : "Release vote open, you haven't voted"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>Campaigns you started</h2>
        {data.mine.length === 0 ? (
          <p className="muted">
            None yet. <Link to="/start">Start one</Link>
          </p>
        ) : (
          <div className="grid">
            {data.mine.map((c) => (
              <CampaignCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>Campaigns you gave to</h2>
        {data.gave.length === 0 ? (
          <p className="muted">
            <Link to="/">Find a cause</Link> to support.
          </p>
        ) : (
          <div className="grid">
            {data.gave.map((c) => (
              <CampaignCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
