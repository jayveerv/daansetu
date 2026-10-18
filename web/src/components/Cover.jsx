import { useState } from "react";
import { category } from "../lib/categories";

function Motif({ kind, ink }) {
  const common = { stroke: ink, fill: "none", strokeWidth: 2, opacity: 0.55 };
  switch (kind) {
    case "rows":
      return [...Array(9)].map((_, i) => <line key={i} x1="0" x2="400" y1={20 + i * 22} y2={20 + i * 22} {...common} />);
    case "plus":
      return [...Array(24)].map((_, i) => {
        const x = 30 + (i % 6) * 68, y = 30 + Math.floor(i / 6) * 55;
        return <path key={i} d={`M${x - 8} ${y}h16M${x} ${y - 8}v16`} {...common} />;
      });
    case "leaf":
      return [...Array(14)].map((_, i) => {
        const x = 20 + (i % 7) * 60, y = 50 + Math.floor(i / 7) * 100;
        return <path key={i} d={`M${x} ${y + 30}C${x} ${y} ${x + 30} ${y - 10} ${x + 40} ${y - 20}C${x + 40} ${y + 10} ${x + 20} ${y + 30} ${x} ${y + 30}Z`} {...common} />;
      });
    case "wave":
      return [...Array(7)].map((_, i) => (
        <path key={i} d={`M0 ${30 + i * 30} q25 -16 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0`} {...common} />
      ));
    case "rings":
      return [...Array(12)].map((_, i) => (
        <circle key={i} cx={40 + (i % 4) * 110} cy={50 + Math.floor(i / 4) * 80} r={26} {...common} />
      ));
    case "grid":
      return [...Array(30)].map((_, i) => (
        <rect key={i} x={14 + (i % 10) * 40} y={20 + Math.floor(i / 10) * 70} width="24" height="24" {...common} />
      ));
    default:
      return [...Array(60)].map((_, i) => (
        <circle key={i} cx={12 + (i % 12) * 34} cy={20 + Math.floor(i / 12) * 44} r={4} fill={ink} opacity={0.35} />
      ));
  }
}

/** Campaign image, or a generated cover in the cause's colours when there is none / it fails to load. */
export default function Cover({ imageUrl, cat, title, className = "" }) {
  const [broken, setBroken] = useState(false);
  const c = category(cat);
  if (imageUrl && !broken) {
    return (
      <div className={`cover ${className}`}>
        <img src={imageUrl} alt="" loading="lazy" onError={() => setBroken(true)} />
      </div>
    );
  }
  return (
    <div className={`cover ${className}`} style={{ background: c.wash }} aria-hidden="true">
      <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice">
        <Motif kind={c.motif} ink={c.ink} />
      </svg>
      <span className="cover__initial" style={{ color: c.ink }}>
        {(title || c.name).trim().charAt(0)}
      </span>
    </div>
  );
}
