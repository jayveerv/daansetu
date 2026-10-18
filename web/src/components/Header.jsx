import { NavLink, Link } from "react-router-dom";
import { useWallet } from "../lib/wallet";
import { CHAIN, ensureChain } from "../lib/chain";
import { short } from "../lib/format";

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="DaanSetu home">
      <svg viewBox="0 0 40 24" width="40" height="24" aria-hidden="true">
        <path d="M2 18 Q20 2 38 18" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M2 18h36" stroke="var(--haldi)" strokeWidth="3.5" />
        {[8, 14, 20, 26, 32].map((x) => (
          <line key={x} x1={x} x2={x} y1={18} y2={x === 20 ? 10 : x === 14 || x === 26 ? 11.5 : 14} stroke="currentColor" strokeWidth="1.5" />
        ))}
      </svg>
      <span>
        Daan<b>Setu</b>
      </span>
    </Link>
  );
}

export default function Header() {
  const { account, connect, wrongChain } = useWallet();
  return (
    <header className="site-header">
      <div className="wrap site-header__in">
        <Logo />
        <nav className="nav">
          <NavLink to="/" end>
            Causes
          </NavLink>
          <NavLink to="/start">Start a campaign</NavLink>
          <NavLink to="/mine">My giving</NavLink>
          <NavLink to="/how">How it works</NavLink>
        </nav>
        {account ? (
          wrongChain ? (
            <button className="btn btn--warn btn--sm" onClick={() => ensureChain().catch(() => {})}>
              Switch to {CHAIN.name}
            </button>
          ) : (
            <span className="acct" title={account}>
              <span className="acct__dot" aria-hidden="true" />
              {short(account)}
            </span>
          )
        ) : (
          <button className="btn btn--ink btn--sm" onClick={connect}>
            Connect wallet
          </button>
        )}
      </div>
    </header>
  );
}
