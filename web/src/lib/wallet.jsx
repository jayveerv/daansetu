import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CHAIN_ID, friendlyError, getWriteContract, hasWallet, explorerTx } from "./chain";

const WalletCtx = createContext(null);

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [walletChain, setWalletChain] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [version, setVersion] = useState(0); // bump to make pages re-fetch after a tx
  const toastId = useRef(0);

  const toast = useCallback((t) => {
    const id = ++toastId.current;
    setToasts((all) => [...all.filter((x) => x.key !== t.key || !t.key), { id, ...t }]);
    if (t.kind !== "pending") setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), 7000);
    return id;
  }, []);
  const dismiss = useCallback((id) => setToasts((all) => all.filter((x) => x.id !== id)), []);

  useEffect(() => {
    if (!hasWallet()) return;
    const eth = window.ethereum;
    eth.request({ method: "eth_accounts" }).then((a) => setAccount(a[0] || null)).catch(() => {});
    eth.request({ method: "eth_chainId" }).then((c) => setWalletChain(parseInt(c, 16))).catch(() => {});
    const onAcc = (a) => setAccount(a[0] || null);
    const onChain = (c) => setWalletChain(parseInt(c, 16));
    eth.on?.("accountsChanged", onAcc);
    eth.on?.("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAcc);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    if (!hasWallet()) {
      toast({
        kind: "error",
        title: "No wallet in this browser",
        body: "Install the MetaMask extension (or open this site in the MetaMask app), then reload.",
        link: { href: "https://metamask.io/download/", label: "Get MetaMask" },
      });
      return null;
    }
    try {
      const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accs[0] || null);
      return accs[0] || null;
    } catch (e) {
      toast({ kind: "error", title: "Wallet not connected", body: friendlyError(e) });
      return null;
    }
  }, [toast]);

  /**
   * Run a contract write with consistent feedback.
   * fn receives the signer-connected contract and returns a tx promise.
   */
  const send = useCallback(
    async (label, fn, doneText) => {
      const acc = account || (await connect());
      if (!acc) return null;
      const pending = toast({ kind: "pending", title: label, body: "Confirm in your wallet." });
      try {
        const contract = await getWriteContract();
        const tx = await fn(contract);
        setToasts((all) =>
          all.map((t) => (t.id === pending ? { ...t, body: "Waiting for the block to confirm…" } : t)),
        );
        const receipt = await tx.wait();
        dismiss(pending);
        const href = explorerTx(tx.hash);
        toast({ kind: "ok", title: doneText, link: href ? { href, label: "View transaction" } : null });
        setVersion((v) => v + 1);
        return receipt;
      } catch (e) {
        dismiss(pending);
        toast({ kind: "error", title: `${label} failed`, body: friendlyError(e) });
        return null;
      }
    },
    [account, connect, toast, dismiss],
  );

  const value = {
    account,
    walletChain,
    wrongChain: !!account && walletChain !== null && walletChain !== CHAIN_ID,
    connect,
    send,
    toast,
    version,
    refresh: () => setVersion((v) => v + 1),
  };

  return (
    <WalletCtx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`}>
            <div className="toast__body">
              <strong>{t.title}</strong>
              {t.body && <p>{t.body}</p>}
              {t.link && (
                <a href={t.link.href} target="_blank" rel="noreferrer">
                  {t.link.label}
                </a>
              )}
            </div>
            <button className="toast__x" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </WalletCtx.Provider>
  );
}

export function useWallet() {
  return useContext(WalletCtx);
}

/** Generic async loader that re-runs when deps or the wallet version change. */
export function useLoader(fn, deps) {
  const { version } = useWallet();
  const [state, setState] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    fn()
      .then((data) => live && setState({ loading: false, data, error: null }))
      .catch((error) => live && setState({ loading: false, data: null, error }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);
  return state;
}
