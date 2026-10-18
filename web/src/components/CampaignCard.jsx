import { Link } from "react-router-dom";
import Cover from "./Cover";
import Setu from "./Setu";
import { category } from "../lib/categories";
import { eth, pct, timeLeft } from "../lib/format";

export function statusLine(c) {
  switch (c.status) {
    case "Active": {
      const left = timeLeft(c.deadline);
      return left ? `${left} left` : "Closing";
    }
    case "Funded":
      return c.milestones.some((m) => m.state === "Voting") ? "Fully funded, donors voting" : "Fully funded";
    case "Completed":
      return "All money released";
    case "Failed":
      return "Goal missed, donors can claim refunds";
    case "Cancelled":
      return "Cancelled, donors can claim refunds";
    default:
      return c.status;
  }
}

export default function CampaignCard({ c }) {
  const cat = category(c.category);
  return (
    <Link to={`/campaign/${c.id}`} className="ccard">
      <Cover imageUrl={c.imageUrl} cat={c.category} title={c.title} className="ccard__cover" />
      <div className="ccard__body">
        <span className="ccard__cat" style={{ color: cat.ink }}>
          {c.category}
        </span>
        <h3 className="ccard__title">{c.title}</h3>
        <Setu c={c} compact />
        <p className="ccard__money">
          <strong>{eth(c.raised)}</strong> of {eth(c.goal)} <span className="muted">({Math.floor(pct(c.raised, c.goal))}%)</span>
        </p>
        <p className={`ccard__status st--${c.status.toLowerCase()}`}>
          {statusLine(c)}
          {c.donorCount > 0 && <span className="muted">, {c.donorCount} donor{c.donorCount === 1 ? "" : "s"}</span>}
        </p>
      </div>
    </Link>
  );
}
