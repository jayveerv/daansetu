import { HashRouter, Route, Routes, Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Header, { Logo } from "./components/Header";
import Home from "./pages/Home";
import Campaign from "./pages/Campaign";
import Create from "./pages/Create";
import Mine from "./pages/Mine";
import How from "./pages/How";
import { WalletProvider } from "./lib/wallet";
import { CHAIN, CONTRACT_ADDRESS } from "./lib/chain";

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  return (
    // HashRouter so deep links work on static hosts like GitHub Pages without rewrites.
    <HashRouter>
      <WalletProvider>
        <ScrollTop />
        <Header />
        {!CONTRACT_ADDRESS && (
          <div className="notice notice--warn wrap">
            <strong>Contract not configured.</strong> Deploy DaanSetu to {CHAIN.name} and rebuild, or set VITE_CONTRACT_ADDRESS.
          </div>
        )}
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/campaign/:id" element={<Campaign />} />
            <Route path="/start" element={<Create />} />
            <Route path="/mine" element={<Mine />} />
            <Route path="/how" element={<How />} />
            <Route path="*" element={<div className="wrap pad empty"><p>This page doesn't exist.</p><Link to="/" className="btn btn--ink">Go to causes</Link></div>} />
          </Routes>
        </main>
        <footer className="site-footer">
          <div className="wrap site-footer__in">
            <Logo />
            <p className="muted small">
              Running on {CHAIN.name}. Test network coins only, no real money. No platform fee.
            </p>
            <Link to="/how" className="small">How it works</Link>
          </div>
        </footer>
      </WalletProvider>
    </HashRouter>
  );
}
