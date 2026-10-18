import { cloneElement, useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseEther } from "ethers";
import Setu from "../components/Setu";
import Cover from "../components/Cover";
import { CATEGORIES } from "../lib/categories";
import { getReadContract, SYMBOL } from "../lib/chain";
import { eth } from "../lib/format";
import { useWallet } from "../lib/wallet";

const blank = { title: "", amount: "" };

function safeWei(v) {
  try {
    const w = parseEther(String(v || "0").trim() || "0");
    return w > 0n ? w : 0n;
  } catch {
    return 0n;
  }
}

export default function Create() {
  const { send, account, connect } = useWallet();
  const nav = useNavigate();
  const [f, setF] = useState({ title: "", category: "Education", imageUrl: "", story: "", days: 30 });
  const [ms, setMs] = useState([{ ...blank }, { ...blank }]);
  const [submitted, setSubmitted] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const amounts = ms.map((m) => safeWei(m.amount));
  const goal = amounts.reduce((a, b) => a + b, 0n);
  const preview = {
    goal: goal || 1n,
    raised: 0n,
    cancelled: false,
    status: "Active",
    currentMilestone: 0,
    milestones: ms.map((m, i) => ({ title: m.title || `Milestone ${i + 1}`, amount: amounts[i] || 0n, state: "Pending" })),
  };

  // Errors appear after the first publish attempt, then update live as fields are fixed.
  const errors = submitted ? findErrors() : {};

  function findErrors() {
    const e = {};
    if (!f.title.trim()) e.title = "Give your campaign a title.";
    else if (new TextEncoder().encode(f.title).length > 100) e.title = "Keep the title under 100 characters.";
    if (f.story.trim().length < 40) e.story = "Tell donors a little more: at least 40 characters about who this helps and how.";
    const d = Number(f.days);
    if (!(d >= 1 && d <= 180)) e.days = "Pick between 1 and 180 days.";
    if (f.imageUrl && !/^https:\/\//i.test(f.imageUrl.trim())) e.imageUrl = "Use an https:// image link, or leave it empty.";
    ms.forEach((m, i) => {
      if (!m.title.trim()) e[`m${i}t`] = "Say what this money is for.";
      if (!amounts[i]) e[`m${i}a`] = `Enter an amount in ${SYMBOL}.`;
    });
    return e;
  }

  async function submit(ev) {
    ev.preventDefault();
    setSubmitted(true);
    if (Object.keys(findErrors()).length) return;
    if (!account && !(await connect())) return;
    // Use chain time so a wallet with a skewed clock can't produce an invalid deadline.
    const block = await getReadContract().runner.getBlock("latest");
    const deadline = Number(block.timestamp) + Math.round(Number(f.days) * 86400);
    const r = await send(
      "Creating campaign",
      (ct) =>
        ct.createCampaign(
          f.title.trim(),
          f.story.trim(),
          f.category,
          f.imageUrl.trim(),
          deadline,
          ms.map((m) => m.title.trim()),
          amounts,
        ),
      "Campaign is live.",
    );
    if (r) {
      const iface = getReadContract().interface;
      const log = r.logs.map((l) => { try { return iface.parseLog(l); } catch { return null; } }).find((x) => x?.name === "CampaignCreated");
      nav(log ? `/campaign/${log.args.id}` : "/");
    }
  }

  const updateM = (i, k) => (e) => setMs(ms.map((m, j) => (j === i ? { ...m, [k]: e.target.value } : m)));

  return (
    <div className="wrap create">
      <h1>Start a campaign</h1>
      <p className="lede">
        Split your goal into milestones. Donors' money waits in the contract, and you unlock each milestone by asking donors
        to approve it. If you don't reach the goal by the deadline, everyone gets their money back automatically.
      </p>

      <form className="create__grid" onSubmit={submit} noValidate>
        <div className="create__form">
          <Field label="Title" err={errors.title}>
            <input value={f.title} onChange={set("title")} maxLength={100} placeholder="Ration kits for 50 families in Halol" />
          </Field>
          <div className="two">
            <Field label="Cause">
              <select value={f.category} onChange={set("category")}>
                {CATEGORIES.map((c) => (
                  <option key={c.name}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Runs for (days)" err={errors.days}>
              <input type="number" min={1} max={180} value={f.days} onChange={set("days")} />
            </Field>
          </div>
          <Field label="Story" err={errors.story} hint="Who it helps, what exactly you'll buy or do, and how you'll show proof.">
            <textarea rows={7} maxLength={4000} value={f.story} onChange={set("story")} />
          </Field>
          <Field label="Cover image link (optional)" err={errors.imageUrl} hint="Leave empty and we'll draw a cover in your cause's colours.">
            <input value={f.imageUrl} onChange={set("imageUrl")} placeholder="https://…" />
          </Field>

          <fieldset className="milestones">
            <legend>Milestones</legend>
            <p className="muted small">Up to 5. They're released in this order, and together they make your goal.</p>
            <ol>
              {ms.map((m, i) => (
                <li key={i}>
                  <div className="ms-row">
                    <Field label={`Milestone ${i + 1}`} err={errors[`m${i}t`]}>
                      <input value={m.title} maxLength={120} onChange={updateM(i, "title")} placeholder={i === 0 ? "Buy first batch of kits" : "What this tranche pays for"} />
                    </Field>
                    <Field label={SYMBOL} err={errors[`m${i}a`]}>
                      <input inputMode="decimal" value={m.amount} onChange={updateM(i, "amount")} placeholder="0.2" />
                    </Field>
                    {ms.length > 1 && (
                      <button type="button" className="linkish ms-x" aria-label={`Remove milestone ${i + 1}`} onClick={() => setMs(ms.filter((_, j) => j !== i))}>
                        Remove
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {ms.length < 5 && (
              <button type="button" className="btn btn--line btn--sm" onClick={() => setMs([...ms, { ...blank }])}>
                Add milestone
              </button>
            )}
          </fieldset>
        </div>

        <aside className="create__preview">
          <div className="panel">
            <Cover imageUrl={f.imageUrl} cat={f.category} title={f.title} className="create__cover" />
            <h3>{f.title || "Your campaign title"}</h3>
            <p className="money__raised">{eth(goal)}</p>
            <p className="muted small">total goal</p>
            <Setu c={preview} />
            <button className="btn btn--haldi btn--block" type="submit">
              {account ? "Publish campaign" : "Connect wallet and publish"}
            </button>
            <p className="muted small">Publishing is a blockchain transaction, so your wallet will ask you to pay a small gas fee.</p>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Field({ label, err, hint, children }) {
  const id = useId();
  const noteId = `${id}-note`;
  const control = cloneElement(children, {
    id,
    "aria-invalid": err ? true : undefined,
    "aria-describedby": err || hint ? noteId : undefined,
  });
  return (
    <div className={`field ${err ? "field--err" : ""}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {control}
      {hint && !err && (
        <span className="field__hint" id={noteId}>
          {hint}
        </span>
      )}
      {err && (
        <span className="field-err" id={noteId}>
          {err}
        </span>
      )}
    </div>
  );
}
