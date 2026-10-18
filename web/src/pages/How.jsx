import { Link } from "react-router-dom";
import { CHAIN, CONTRACT_ADDRESS, explorerAddress } from "../lib/chain";

const steps = [
  ["A creator splits the goal into milestones", "Each milestone says what the money is for and how much it needs. The goal is the sum of them."],
  ["Donors give, and the money stays in the contract", "Nothing goes to the creator yet. Every donation is written to the public ledger with the donor's wallet and message."],
  ["Goal missed? Everyone takes their money back", "If the deadline passes before the goal is reached, each donor can claim a full refund."],
  ["The creator asks to unlock one milestone", "Donors get a voting window. Each donor's vote is weighted by how much they gave. The release goes through unless more weight votes to block it."],
  ["Blocked twice, the campaign is cancelled", "Whatever is still in escrow is shared back to donors in proportion to what they gave. Donors can also cancel a funded campaign whose creator goes silent for 30 days."],
];

export default function How() {
  const href = CONTRACT_ADDRESS ? explorerAddress(CONTRACT_ADDRESS) : "";
  return (
    <div className="wrap how">
      <h1>How DaanSetu keeps donations honest</h1>
      <p className="lede">
        Most crowdfunding asks you to trust that the money will be used well. DaanSetu replaces that trust with rules that run
        on the blockchain, where no one, including us, can change them or move the money.
      </p>
      <ol className="steps">
        {steps.map(([t, d]) => (
          <li key={t}>
            <h3>{t}</h3>
            <p>{d}</p>
          </li>
        ))}
      </ol>

      <section className="panel">
        <h2>What you need</h2>
        <p>
          A wallet like MetaMask, set to {CHAIN.name}. This is a test network, so the coins have no real value. You can get some free
          from a faucet to try donating.
        </p>
        <p>
          Contract:{" "}
          {CONTRACT_ADDRESS ? (
            href ? (
              <a href={href} target="_blank" rel="noreferrer" className="mono-ish">
                {CONTRACT_ADDRESS}
              </a>
            ) : (
              <span className="mono-ish">{CONTRACT_ADDRESS}</span>
            )
          ) : (
            "not deployed yet"
          )}
        </p>
        <p>DaanSetu takes no platform fee. The only cost is the network's gas fee for each transaction.</p>
      </section>
      <p>
        <Link to="/" className="btn btn--haldi">
          Browse causes
        </Link>
      </p>
    </div>
  );
}
