import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { parseEther } from "ethers";
import Cover from "../components/Cover";
import Setu from "../components/Setu";
import { statusLine } from "../components/CampaignCard";
import { category } from "../lib/categories";
import { explorerAddress, fetchCampaign, SYMBOL } from "../lib/chain";
import { dateStr, dateTimeStr, eth, ethNum, nowSec, pct, sameAddr, short, timeLeft } from "../lib/format";
import { useLoader, useWallet } from "../lib/wallet";
import { SetupNotice } from "./Home";

export default function Campaign() {
  const { id } = useParams();
  const { account } = useWallet();
  const { data: c, loading, error } = useLoader(() => fetchCampaign(Number(id), account), [id, account]);

  if (error) {
    return (
      <div className="wrap pad">
        {String(error.message || "").includes("no such campaign") ? (
          <div className="empty">
            <p>There's no campaign #{id}.</p>
            <Link to="/" className="btn btn--ink">
              See all causes
            </Link>
          </div>
        ) : (
          <SetupNotice error={error} />
        )}
      </div>
    );
  }
  if (loading && !c) return <p className="wrap pad muted">Loading campaign…</p>;

  const cat = category(c.category);
  const isCreator = sameAddr(account, c.creator);
  const isDonor = c.me && c.me.contribution > 0n;
  const current = c.milestones[c.currentMilestone];
  const creatorHref = explorerAddress(c.creator);

  return (
    <article className="campaign">
      <div className="wrap">
        <Link to="/" className="back">
          All causes
        </Link>
      </div>
      <div className="wrap campaign__top">
        <Cover imageUrl={c.imageUrl} cat={c.category} title={c.title} className="campaign__cover" />
        <div className="campaign__head">
          <span className="ccard__cat" style={{ color: cat.ink }}>
            {c.category}
          </span>
          <h1>{c.title}</h1>
          <p className="muted">
            Started {dateStr(c.createdAt)} by{" "}
            {creatorHref ? (
              <a href={creatorHref} target="_blank" rel="noreferrer" className="mono-ish">
                {short(c.creator)}
              </a>
            ) : (
              <span className="mono-ish">{short(c.creator)}</span>
            )}
            {isCreator && <span className="tag">You</span>}
          </p>
        </div>
      </div>

      <div className="wrap campaign__grid">
        <div className="campaign__main">
          <section className="panel panel--setu">
            <h2>Where the money is</h2>
            <p className="muted small">
              {eth(c.released)} released to the creator,{" "}
              {c.cancelled || c.status === "Failed"
                ? `${eth(c.raised - c.released)} returned to donors to claim.`
                : `${eth(c.raised - c.released)} held in escrow.`}
            </p>
            <Setu c={c} />
          </section>

          {current && current.state === "Voting" && <VotePanel c={c} m={current} isDonor={isDonor} />}
          {isCreator && <CreatorPanel c={c} />}
          {isDonor && !isCreator && <InactivityPanel c={c} />}

          <section className="story">
            <h2>The story</h2>
            {c.story ? c.story.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>) : <p className="muted">No story yet.</p>}
          </section>

          <section>
            <h2>Updates from the creator</h2>
            {c.updates.length === 0 ? (
              <p className="muted">No updates yet.</p>
            ) : (
              <ul className="updates">
                {c.updates.map((u, i) => (
                  <li key={i}>
                    <time>{dateTimeStr(u.time)}</time>
                    <p>{u.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Khata c={c} account={account} />
        </div>

        <aside className="campaign__side">
          <MoneyPanel c={c} />
          {c.me?.refundable > 0n && <RefundPanel c={c} />}
          {isDonor && (
            <p className="mine-note">
              You've given {eth(c.me.contribution)}, which is {pct(c.me.contribution, c.raised).toFixed(1)}% of the vote on
              each release.
            </p>
          )}
        </aside>
      </div>
    </article>
  );
}

function MoneyPanel({ c }) {
  const { send } = useWallet();
  const remaining = c.goal - c.raised;
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const presets = ["0.01", "0.05", "0.1"].filter((p) => parseEther(p) <= remaining);

  async function donate(e) {
    e.preventDefault();
    setErr("");
    let wei;
    try {
      wei = parseEther(amount || "0");
    } catch {
      return setErr(`Enter an amount like 0.05`);
    }
    if (wei <= 0n) return setErr("Enter an amount above zero.");
    if (wei > remaining) return setErr(`Only ${eth(remaining)} is left to reach the goal.`);
    const r = await send("Donating", (ct) => ct.donate(c.id, note.trim(), { value: wei }), `Donated ${eth(wei)}. Thank you.`);
    if (r) {
      setAmount("");
      setNote("");
    }
  }

  return (
    <section className="panel panel--money">
      <p className="money__raised">{eth(c.raised)}</p>
      <p className="muted">
        raised of {eth(c.goal)} goal, from {c.donorCount} donor{c.donorCount === 1 ? "" : "s"}
      </p>
      <div className="bar" aria-hidden="true">
        <span style={{ width: `${pct(c.raised, c.goal)}%` }} />
      </div>
      <p className={`ccard__status st--${c.status.toLowerCase()}`}>{statusLine(c)}</p>
      {c.status === "Active" && <p className="muted small">Ends {dateTimeStr(c.deadline)}. If the goal isn't reached by then, every donor can take their money back.</p>}

      {c.status === "Active" && (
        <form onSubmit={donate} className="donate">
          <label htmlFor="amt">Amount ({SYMBOL})</label>
          <div className="presets">
            {presets.map((p) => (
              <button type="button" key={p} className={`chip ${amount === p ? "chip--on" : ""}`} onClick={() => setAmount(p)}>
                {p}
              </button>
            ))}
            <button type="button" className="chip" onClick={() => setAmount(ethNum(remaining, 18).replace(/,/g, ""))}>
              Complete the goal
            </button>
          </div>
          <input
            id="amt"
            inputMode="decimal"
            placeholder="0.05"
            value={amount}
            onChange={(e) => setAmount(e.target.value.trim())}
          />
          <label htmlFor="note">Message (optional, public)</label>
          <input id="note" maxLength={200} placeholder="Say something to the creator" value={note} onChange={(e) => setNote(e.target.value)} />
          {err && <p className="field-err">{err}</p>}
          <button className="btn btn--haldi btn--block" type="submit">
            Donate
          </button>
          <p className="muted small">Your donation stays in escrow until donors approve each milestone.</p>
        </form>
      )}
    </section>
  );
}

function VotePanel({ c, m, isDonor }) {
  const { send } = useWallet();
  const left = timeLeft(m.voteEnd);
  const total = m.yesWeight + m.noWeight;
  const yesPct = total === 0n ? 0 : pct(m.yesWeight, total);
  const label = `milestone ${c.currentMilestone + 1}`;

  return (
    <section className="panel panel--vote">
      <h2>
        Release of {eth(m.amount)} for “{m.title}”
      </h2>
      <p>
        {left
          ? `The creator has asked to unlock this milestone. Donors have ${left} to respond. It goes through unless more donation weight votes to block it than to approve.`
          : "Voting has ended. Anyone can close the vote to apply the result."}
        {m.round > 1 && ` This is attempt ${m.round}; ${c.rejections} earlier request${c.rejections === 1 ? " was" : "s were"} blocked. A second block cancels the campaign and refunds donors.`}
      </p>
      <div className="votebar" aria-label={`Approve ${yesPct}%`}>
        <span className="votebar__yes" style={{ width: `${total === 0n ? 0 : yesPct}%` }} />
        <span className="votebar__no" style={{ width: `${total === 0n ? 0 : 100 - yesPct}%` }} />
      </div>
      <p className="small">
        Approve {eth(m.yesWeight)} &nbsp; Block {eth(m.noWeight)} &nbsp;
        <span className="muted">{total === 0n ? "No votes yet, so it would pass." : ""}</span>
      </p>
      {left && isDonor && !c.me.voted && (
        <div className="row">
          <button className="btn btn--ink" onClick={() => send("Voting", (ct) => ct.vote(c.id, true), `You approved ${label}.`)}>
            Approve release
          </button>
          <button className="btn btn--kumkum" onClick={() => send("Voting", (ct) => ct.vote(c.id, false), `You voted to block ${label}.`)}>
            Block release
          </button>
        </div>
      )}
      {left && isDonor && c.me.voted && <p className="muted">You've voted on this request.</p>}
      {left && !isDonor && <p className="muted small">Only donors to this campaign can vote.</p>}
      {!left && (
        <button className="btn btn--ink" onClick={() => send("Closing the vote", (ct) => ct.finalizeVote(c.id), "Vote closed and result applied.")}>
          Close vote and apply result
        </button>
      )}
    </section>
  );
}

function CreatorPanel({ c }) {
  const { send } = useWallet();
  const [text, setText] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const current = c.milestones[c.currentMilestone];
  const canRequest = c.status === "Funded" && current && (current.state === "Pending" || current.state === "Rejected");
  const canCancel = c.status === "Active" || c.status === "Funded";
  const hours = Math.round(c.votingPeriod / 3600);
  const windowText = c.votingPeriod >= 86400 ? `${Math.round(c.votingPeriod / 86400)} days` : hours >= 1 ? `${hours} hours` : `${Math.round(c.votingPeriod / 60)} minutes`;

  async function post(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const r = await send("Posting update", (ct) => ct.postUpdate(c.id, text.trim()), "Update posted.");
    if (r) setText("");
  }

  return (
    <section className="panel panel--creator">
      <h2>Your campaign</h2>
      {c.status === "Active" && <p>Once the goal is fully funded you can start unlocking milestones.</p>}
      {canRequest && (
        <div className="creator__req">
          <p>
            Next up: <strong>{current.title}</strong> ({eth(current.amount)}). Donors get {windowText} to respond.
            {current.state === "Rejected" && " Donors blocked the last request. Post an update explaining what changed before you ask again."}
          </p>
          <button className="btn btn--haldi" onClick={() => send("Requesting release", (ct) => ct.requestRelease(c.id), "Release requested. Donors can vote now.")}>
            Ask donors to release {eth(current.amount)}
          </button>
        </div>
      )}
      {c.status === "Completed" && <p>Every milestone has been released. Keep posting updates so donors can see the impact.</p>}

      <form onSubmit={post} className="creator__update">
        <label htmlFor="upd">Post an update (bills, photos links, progress)</label>
        <textarea id="upd" rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn btn--line" type="submit" disabled={!text.trim()}>
          Post update
        </button>
      </form>

      {canCancel && (
        <div className="creator__cancel">
          {!confirmCancel ? (
            <button className="linkish" onClick={() => setConfirmCancel(true)}>
              Cancel this campaign
            </button>
          ) : (
            <div className="row">
              <span>Everything still in escrow goes back to donors. This can't be undone.</span>
              <button className="btn btn--kumkum btn--sm" onClick={() => send("Cancelling", (ct) => ct.cancel(c.id), "Campaign cancelled. Donors can claim refunds.")}>
                Yes, cancel campaign
              </button>
              <button className="btn btn--line btn--sm" onClick={() => setConfirmCancel(false)}>
                Keep it
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function InactivityPanel({ c }) {
  const { send } = useWallet();
  const current = c.milestones[c.currentMilestone];
  const idleUntil = c.lastActivity + c.inactivityPeriod;
  if (c.status !== "Funded" || !current || current.state === "Voting") return null;
  if (nowSec() < idleUntil) return null;
  return (
    <section className="panel panel--warn">
      <h2>The creator has gone quiet</h2>
      <p>No update or release request since {dateStr(c.lastActivity)}. As a donor you can cancel the campaign so everyone gets back what's still in escrow.</p>
      <button className="btn btn--kumkum" onClick={() => send("Cancelling", (ct) => ct.cancelForInactivity(c.id), "Campaign cancelled. Claim your refund.")}>
        Cancel and unlock refunds
      </button>
    </section>
  );
}

function RefundPanel({ c }) {
  const { send } = useWallet();
  return (
    <section className="panel panel--refund">
      <h2>{eth(c.me.refundable)} is yours to take back</h2>
      <p className="small">
        {c.status === "Failed" ? "The goal wasn't reached in time, so your full donation is refundable." : "This campaign was cancelled. You get your share of what was still in escrow."}
      </p>
      <button className="btn btn--ink btn--block" onClick={() => send("Claiming refund", (ct) => ct.claimRefund(c.id), `Refunded ${eth(c.me.refundable)} to your wallet.`)}>
        Claim refund
      </button>
    </section>
  );
}

/** The public ledger, drawn like a bahi-khata page. */
function Khata({ c, account }) {
  return (
    <section className="khata">
      <h2>Donation ledger</h2>
      <p className="muted small">Every donation is recorded on the blockchain and can't be edited or hidden.</p>
      {c.donations.length === 0 ? (
        <p className="khata__empty">No donations yet.</p>
      ) : (
        <div className="khata__page">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Donor</th>
                <th>Message</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {c.donations.map((d, i) => (
                <tr key={i}>
                  <td>{dateStr(d.time)}</td>
                  <td>
                    {short(d.donor)}
                    {sameAddr(d.donor, account) && <span className="tag">You</span>}
                  </td>
                  <td className="khata__note">{d.note}</td>
                  <td className="num">{ethNum(d.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total ({SYMBOL})</td>
                <td className="num">{ethNum(c.raised)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
