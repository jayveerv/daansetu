import { eth, timeLeft } from "../lib/format";

/**
 * The "setu": the campaign's money drawn as a bridge of planks, one per milestone.
 * Plank width = milestone amount. Each plank fills as donations arrive and changes
 * colour as it moves Locked -> Voting -> Released (or Blocked).
 */
export function stateLabel(m, i, c) {
  if (m.state === "Released") return "Released to creator";
  if (m.state === "Voting") {
    const left = timeLeft(m.voteEnd);
    return left ? `Donors voting, ${left} left` : "Vote ended, ready to close";
  }
  if (m.state === "Rejected") return c.cancelled ? "Refunded to donors" : "Blocked by donors";
  if (c.cancelled) return "Refunded to donors";
  if (c.status === "Failed") return "Goal missed, refundable";
  return i === c.currentMilestone && c.status === "Funded" ? "Next to unlock" : "Locked in escrow";
}

export default function Setu({ c, compact = false }) {
  let before = 0n;
  const planks = c.milestones.map((m, i) => {
    const start = before;
    before += m.amount;
    const filled = c.raised <= start ? 0n : c.raised >= before ? m.amount : c.raised - start;
    const fillPct = m.amount === 0n ? 0 : Number((filled * 10000n) / m.amount) / 100;
    const share = Number((m.amount * 10000n) / (c.goal || 1n)) / 100;
    const kind =
      m.state === "Released"
        ? "released"
        : m.state === "Voting"
          ? "voting"
          : m.state === "Rejected" || c.cancelled || c.status === "Failed"
            ? "blocked"
            : "locked";
    return { m, i, fillPct, share, kind };
  });

  return (
    <div className={`setu ${compact ? "setu--compact" : ""}`}>
      <div className="setu__deck" role="img" aria-label={`${c.milestones.length} milestones`}>
        {planks.map(({ m, i, fillPct, share, kind }) => (
          <div key={i} className={`plank plank--${kind}`} style={{ flexGrow: share, flexBasis: 0 }} title={m.title}>
            <div className="plank__fill" style={{ width: `${kind === "released" ? 100 : fillPct}%` }} />
          </div>
        ))}
      </div>
      {!compact && (
        <ol className="setu__legend">
          {planks.map(({ m, i, kind, share }) => (
            <li key={i} className={`leg leg--${kind}`} style={{ flexGrow: share, flexBasis: 0 }}>
              <span className="leg__amt">{eth(m.amount)}</span>
              <span className="leg__title">{m.title}</span>
              <span className="leg__state">{stateLabel(m, i, c)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
