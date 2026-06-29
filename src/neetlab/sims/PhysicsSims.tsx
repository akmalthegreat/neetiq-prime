import { useEffect, useRef, useState } from "react";

/* ============================ Projectile ============================ */
export function ProjectileSim() {
  const [angle, setAngle] = useState(45);
  const [speed, setSpeed] = useState(30);
  const [gravity, setGravity] = useState(9.8);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(true);
  const raf = useRef<number | undefined>(undefined);
  const last = useRef<number>(0);

  useEffect(() => {
    if (!running) return;
    const step = (now: number) => {
      if (!last.current) last.current = now;
      const dt = (now - last.current) / 1000;
      last.current = now;
      setT((prev) => prev + dt);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); last.current = 0; };
  }, [running]);

  const rad = (angle * Math.PI) / 180;
  const vx = speed * Math.cos(rad);
  const vy = speed * Math.sin(rad);
  const totalT = (2 * vy) / gravity;
  const tt = t % (totalT + 0.5);
  const x = vx * tt;
  const y = Math.max(0, vy * tt - 0.5 * gravity * tt * tt);
  const range = (vx * 2 * vy) / gravity;
  const maxH = (vy * vy) / (2 * gravity);

  const W = 600, H = 320, pad = 30;
  const scaleX = (W - 2 * pad) / Math.max(range, 10);
  const scaleY = (H - 2 * pad) / Math.max(maxH * 1.4, 10);
  const px = pad + x * scaleX;
  const py = H - pad - y * scaleY;

  const path: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const ti = (i / 60) * totalT;
    const xi = vx * ti, yi = vy * ti - 0.5 * gravity * ti * ti;
    path.push(`${i === 0 ? "M" : "L"}${pad + xi * scaleX},${H - pad - yi * scaleY}`);
  }

  return (
    <div className="p-5">
      <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-b from-sky-50 to-white">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          <defs>
            <linearGradient id="ground" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#bfdbfe" /><stop offset="1" stopColor="#dbeafe" />
            </linearGradient>
          </defs>
          <rect x="0" y={H - pad} width={W} height={pad} fill="url(#ground)" />
          <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#94a3b8" />
          <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="#94a3b8" />
          <path d={path.join(" ")} fill="none" stroke="#2563eb" strokeWidth={2} strokeDasharray="4 4" opacity={0.5} />
          {/* velocity vector */}
          <line x1={px} y1={py} x2={px + vx * 1.2} y2={py - (vy - gravity * tt) * 1.2} stroke="#dc2626" strokeWidth={2} markerEnd="url(#arr)" />
          <defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#dc2626"/></marker></defs>
          <circle cx={px} cy={py} r={8} fill="#1d4ed8" stroke="white" strokeWidth={2} />
        </svg>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Slider label="Angle" value={angle} min={5} max={85} unit="°" onChange={setAngle} />
        <Slider label="Speed" value={speed} min={5} max={60} unit="m/s" onChange={setSpeed} />
        <Slider label="Gravity" value={gravity} min={1.6} max={25} step={0.1} unit="m/s²" onChange={setGravity} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={() => setRunning((r) => !r)} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          {running ? "Pause" : "Play"}
        </button>
        <button onClick={() => setT(0)} className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-brand-deep">Reset</button>
        <div className="ml-auto grid grid-cols-3 gap-3 text-xs sm:text-sm">
          <Stat label="Range" value={`${range.toFixed(1)} m`} />
          <Stat label="Max height" value={`${maxH.toFixed(1)} m`} />
          <Stat label="Time of flight" value={`${totalT.toFixed(2)} s`} />
        </div>
      </div>
    </div>
  );
}

/* ============================ Atwood (Tension) ============================
 * Physics-driven: integrates a = (m2-m1)g/(m1+m2) so the system actually
 * accelerates and rests when masses are equal. Y is displacement (m, +down for m2).
 */
export function TensionSim() {
  const [m1, setM1] = useState(5);
  const [m2, setM2] = useState(8);
  const [g, setG] = useState(9.8);
  const [y, setY] = useState(0); // m, positive = m2 down / m1 up
  const [v, setV] = useState(0); // m/s
  const [running, setRunning] = useState(true);
  const raf = useRef<number | undefined>(undefined);

  const a = ((m2 - m1) * g) / (m1 + m2);
  const T = (2 * m1 * m2 * g) / (m1 + m2);
  const balanced = Math.abs(m1 - m2) < 0.01;

  useEffect(() => {
    if (!running) return;
    let last = 0;
    const step = (now: number) => {
      if (!last) last = now;
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      setV((prevV) => {
        let nv = prevV + a * dt;
        setY((prevY) => {
          let ny = prevY + nv * dt;
          // bounce at travel limits so it stays on screen
          const lim = 1.3;
          if (ny > lim) { ny = lim; nv = -Math.abs(nv) * 0.6; }
          if (ny < -lim) { ny = -lim; nv = Math.abs(nv) * 0.6; }
          return ny;
        });
        return nv;
      });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [a, running]);

  // Reset velocity/position when balance changes meaningfully
  useEffect(() => { if (balanced) { setV(0); } }, [balanced]);

  // Map physical y (m) → pixels around hanging baseline 170
  const yPx = y * 60;
  const m1Top = 170 - yPx; // m1 rises when y>0
  const m2Top = 170 + yPx;
  const h1 = 30 + m1 * 3;
  const h2 = 30 + m2 * 3;

  // pulley rotation (proportional to rope motion)
  const rotationRef = useRef(0);
  rotationRef.current += v * 0.05;

  return (
    <div className="p-5">
      <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-b from-sky-50 to-white">
        <svg viewBox="0 0 400 360" className="w-full">
          {/* Ceiling */}
          <line x1="0" y1="40" x2="400" y2="40" stroke="#64748b" strokeWidth={6} />
          {/* Pulley support */}
          <line x1="200" y1="40" x2="200" y2="60" stroke="#475569" strokeWidth={3} />
          {/* Pulley wheel */}
          <g transform={`translate(200 80) rotate(${(rotationRef.current * 180) / Math.PI})`}>
            <circle r="26" fill="#cbd5e1" stroke="#475569" strokeWidth={3} />
            <circle r="22" fill="none" stroke="#94a3b8" strokeWidth={1} />
            {[0, 60, 120, 180, 240, 300].map((d) => (
              <line key={d} x1="0" y1="0" x2={Math.cos((d * Math.PI) / 180) * 20} y2={Math.sin((d * Math.PI) / 180) * 20} stroke="#64748b" strokeWidth={1.5} />
            ))}
            <circle r="4" fill="#475569" />
          </g>
          {/* Ropes */}
          <line x1="174" y1="80" x2="120" y2={m1Top} stroke="#1e293b" strokeWidth={2.2} />
          <line x1="226" y1="80" x2="280" y2={m2Top} stroke="#1e293b" strokeWidth={2.2} />
          {/* Mass 1 */}
          <rect x={100} y={m1Top} width={40} height={h1} rx="4" fill="#3b82f6" stroke="#1e40af" strokeWidth={2} />
          <text x={120} y={m1Top + h1 / 2 + 4} textAnchor="middle" fill="white" fontSize="12" fontWeight="700">{m1} kg</text>
          {/* Mass 2 */}
          <rect x={260} y={m2Top} width={40} height={h2} rx="4" fill="#1e40af" stroke="#1e3a8a" strokeWidth={2} />
          <text x={280} y={m2Top + h2 / 2 + 4} textAnchor="middle" fill="white" fontSize="12" fontWeight="700">{m2} kg</text>
          {/* Reference baseline */}
          <line x1="60" y1="170" x2="340" y2="170" stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 4" opacity={0.6} />
          <text x="345" y="174" fontSize="10" fill="#64748b">level</text>
          {balanced && (
            <text x="200" y="330" textAnchor="middle" fontSize="13" fontWeight="700" fill="#16a34a">⚖ Balanced — system at rest</text>
          )}
        </svg>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Slider label="Mass 1" value={m1} min={1} max={20} unit="kg" onChange={(v) => { setM1(v); setV(0); setY(0); }} />
        <Slider label="Mass 2" value={m2} min={1} max={20} unit="kg" onChange={(v) => { setM2(v); setV(0); setY(0); }} />
        <Slider label="Gravity" value={g} min={1.6} max={25} step={0.1} unit="m/s²" onChange={setG} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={() => setRunning((r) => !r)} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{running ? "Pause" : "Play"}</button>
        <button onClick={() => { setY(0); setV(0); }} className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-brand-deep">Reset</button>
        <div className="ml-auto grid grid-cols-3 gap-3 text-xs sm:text-sm">
          <Stat label="Acceleration" value={`${a.toFixed(2)} m/s²`} />
          <Stat label="Tension" value={`${T.toFixed(2)} N`} />
          <Stat label="Heavier" value={balanced ? "Equal" : m2 > m1 ? "Right ↓" : "Left ↓"} />
        </div>
      </div>
    </div>
  );
}

/* ============================ Pendulum ============================ */
export function PendulumSim() {
  const [L, setL] = useState(1.2);
  const [g, setG] = useState(9.8);
  const [damp, setDamp] = useState(0.05);
  const [theta, setTheta] = useState(Math.PI / 6);
  const [omega, setOmega] = useState(0);
  const [running, setRunning] = useState(true);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!running) return;
    let last = 0;
    const step = (now: number) => {
      if (!last) last = now;
      const dt = Math.min((now - last) / 1000, 0.03); last = now;
      setOmega((w) => {
        let nw = w;
        setTheta((th) => {
          const alpha = (-g / L) * Math.sin(th) - damp * nw;
          nw = nw + alpha * dt;
          return th + nw * dt;
        });
        return nw;
      });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [g, L, damp, running]);

  const period = 2 * Math.PI * Math.sqrt(L / g);
  const px = 200 + Math.sin(theta) * L * 120;
  const py = 40 + Math.cos(theta) * L * 120;

  return (
    <div className="p-5">
      <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-b from-sky-50 to-white">
        <svg viewBox="0 0 400 300" className="w-full">
          <line x1="100" y1="40" x2="300" y2="40" stroke="#64748b" strokeWidth={6} />
          {/* arc guide */}
          <path d={`M ${200 - L * 120} 40 A ${L * 120} ${L * 120} 0 0 1 ${200 + L * 120} 40`} fill="none" stroke="#cbd5e1" strokeDasharray="3 3" />
          <line x1="200" y1="40" x2={px} y2={py} stroke="#1e293b" strokeWidth={2} />
          <circle cx={px} cy={py} r={18} fill="#2563eb" stroke="#1e3a8a" strokeWidth={3} />
          {/* angle label */}
          <text x="210" y="60" fontSize="11" fill="#475569">θ = {((theta * 180) / Math.PI).toFixed(1)}°</text>
        </svg>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Slider label="Length" value={L} min={0.3} max={3} step={0.05} unit="m" onChange={setL} />
        <Slider label="Gravity" value={g} min={1.6} max={25} step={0.1} unit="m/s²" onChange={setG} />
        <Slider label="Damping" value={damp} min={0} max={0.5} step={0.01} unit="" onChange={setDamp} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={() => setRunning((r) => !r)} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{running ? "Pause" : "Play"}</button>
        <button onClick={() => { setTheta(Math.PI / 6); setOmega(0); }} className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-brand-deep">Reset</button>
        <div className="ml-auto grid grid-cols-2 gap-3">
          <Stat label="Period T" value={`${period.toFixed(2)} s`} />
          <Stat label="Frequency" value={`${(1 / period).toFixed(2)} Hz`} />
        </div>
      </div>
    </div>
  );
}

/* ============================ Uniform Circular Motion ============================ */
export function CircularMotionSim() {
  const [r, setR] = useState(1.2);     // m
  const [omega, setOmega] = useState(2); // rad/s
  const [m, setM] = useState(1);       // kg
  const [running, setRunning] = useState(true);
  const [t, setT] = useState(0);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!running) return;
    let last = 0;
    const step = (now: number) => {
      if (!last) last = now;
      const dt = (now - last) / 1000; last = now;
      setT((p) => p + dt);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [running]);

  const theta = omega * t;
  const cx = 220, cy = 170;
  const scale = 90;
  const x = cx + Math.cos(theta) * r * scale;
  const y = cy + Math.sin(theta) * r * scale;
  // velocity (tangent), acceleration (centripetal, toward center)
  const v = omega * r;
  const ac = omega * omega * r;
  const Fc = m * ac;
  // vector arrows
  const vx = -Math.sin(theta) * v * 12;
  const vy = Math.cos(theta) * v * 12;
  const axv = (cx - x) * 0.45;
  const ayv = (cy - y) * 0.45;

  return (
    <div className="p-5">
      <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-b from-sky-50 to-white">
        <svg viewBox="0 0 440 340" className="w-full">
          <defs>
            <marker id="va" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#16a34a"/></marker>
            <marker id="aa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#dc2626"/></marker>
          </defs>
          <circle cx={cx} cy={cy} r={r * scale} fill="none" stroke="#cbd5e1" strokeDasharray="4 4" />
          <circle cx={cx} cy={cy} r={4} fill="#475569" />
          {/* string */}
          <line x1={cx} y1={cy} x2={x} y2={y} stroke="#1e293b" strokeWidth={1.5} />
          {/* particle */}
          <circle cx={x} cy={y} r={12 + m * 1.2} fill="#2563eb" stroke="#1e3a8a" strokeWidth={2} />
          {/* velocity (green tangent) */}
          <line x1={x} y1={y} x2={x + vx} y2={y + vy} stroke="#16a34a" strokeWidth={2.5} markerEnd="url(#va)" />
          <text x={x + vx + 4} y={y + vy} fontSize="11" fill="#16a34a" fontWeight="700">v</text>
          {/* centripetal (red, inward) */}
          <line x1={x} y1={y} x2={x + axv} y2={y + ayv} stroke="#dc2626" strokeWidth={2.5} markerEnd="url(#aa)" />
          <text x={x + axv + 4} y={y + ayv} fontSize="11" fill="#dc2626" fontWeight="700">aᶜ</text>
        </svg>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Slider label="Radius" value={r} min={0.4} max={1.6} step={0.05} unit="m" onChange={setR} />
        <Slider label="Angular speed ω" value={omega} min={0.2} max={8} step={0.1} unit="rad/s" onChange={setOmega} />
        <Slider label="Mass" value={m} min={0.2} max={5} step={0.1} unit="kg" onChange={setM} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={() => setRunning((x) => !x)} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{running ? "Pause" : "Play"}</button>
        <button onClick={() => setT(0)} className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-brand-deep">Reset</button>
        <div className="ml-auto grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="v = ωr" value={`${v.toFixed(2)} m/s`} />
          <Stat label="aᶜ = ω²r" value={`${ac.toFixed(2)} m/s²`} />
          <Stat label="Fᶜ = maᶜ" value={`${Fc.toFixed(2)} N`} />
          <Stat label="Period" value={`${((2 * Math.PI) / omega).toFixed(2)} s`} />
        </div>
      </div>
    </div>
  );
}

/* ============================ Rotational Motion (torque → α) ============================ */
export function RotationalMotionSim() {
  const [R, setR] = useState(1);
  const [M, setM] = useState(2);
  const [F, setF] = useState(4);
  const [running, setRunning] = useState(true);
  const [theta, setTheta] = useState(0);
  const [w, setW] = useState(0);
  const raf = useRef<number | undefined>(undefined);

  // Solid disc: I = 0.5 M R²
  const I = 0.5 * M * R * R;
  const tau = F * R;
  const alpha = tau / I;

  useEffect(() => {
    if (!running) return;
    let last = 0;
    const step = (now: number) => {
      if (!last) last = now;
      const dt = Math.min((now - last) / 1000, 0.04); last = now;
      setW((pw) => {
        const nw = pw + alpha * dt;
        setTheta((p) => p + nw * dt);
        return nw;
      });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [alpha, running]);

  const cx = 200, cy = 170;
  const px = 80 * R;

  return (
    <div className="p-5">
      <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-b from-sky-50 to-white">
        <svg viewBox="0 0 400 340" className="w-full">
          <defs>
            <radialGradient id="disc"><stop offset="0" stopColor="#93c5fd"/><stop offset="1" stopColor="#1d4ed8"/></radialGradient>
            <marker id="fa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#dc2626"/></marker>
          </defs>
          <g transform={`translate(${cx} ${cy}) rotate(${(theta * 180) / Math.PI})`}>
            <circle r={px} fill="url(#disc)" stroke="#1e3a8a" strokeWidth={3} />
            {/* spokes */}
            {[0, 45, 90, 135].map((d) => (
              <line key={d} x1={-px} y1={0} x2={px} y2={0} transform={`rotate(${d})`} stroke="rgba(255,255,255,0.7)" strokeWidth={2} />
            ))}
            <circle r={6} fill="#1e3a8a" />
          </g>
          {/* applied force F tangent at right rim */}
          <line x1={cx + px} y1={cy} x2={cx + px} y2={cy - 30 - F * 4} stroke="#dc2626" strokeWidth={3} markerEnd="url(#fa)" />
          <text x={cx + px + 6} y={cy - 20 - F * 2} fontSize="12" fontWeight="700" fill="#dc2626">F = {F} N</text>
          <text x={cx} y={310} textAnchor="middle" fontSize="11" fill="#475569">torque τ = F·R</text>
        </svg>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Slider label="Radius R" value={R} min={0.4} max={1.5} step={0.05} unit="m" onChange={setR} />
        <Slider label="Mass M" value={M} min={0.5} max={10} step={0.1} unit="kg" onChange={setM} />
        <Slider label="Force F" value={F} min={0} max={20} step={0.5} unit="N" onChange={setF} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={() => setRunning((x) => !x)} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{running ? "Pause" : "Play"}</button>
        <button onClick={() => { setTheta(0); setW(0); }} className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-brand-deep">Reset</button>
        <div className="ml-auto grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="I = ½MR²" value={`${I.toFixed(2)} kg·m²`} />
          <Stat label="τ" value={`${tau.toFixed(2)} N·m`} />
          <Stat label="α = τ/I" value={`${alpha.toFixed(2)} rad/s²`} />
          <Stat label="ω" value={`${w.toFixed(2)} rad/s`} />
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-semibold text-ink/80">{label}</span>
        <span className="font-mono text-brand-deep">{value.toFixed(step < 1 ? 2 : 0)} {unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-[oklch(0.55_0.19_255)]" />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-brand-soft px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-brand">{label}</div>
      <div className="font-mono text-sm font-bold text-brand-deep">{value}</div>
    </div>
  );
}

/* ============================ Spring SHM ============================ */
export function SpringSHMSim() {
  const [k, setK] = useState(20);
  const [m, setM] = useState(1);
  const [A, setA] = useState(80);
  const [b, setB] = useState(0.2);
  const [running, setRunning] = useState(true);
  const [t, setT] = useState(0);
  const raf = useRef<number | undefined>(undefined);
  const last = useRef<number>(0);
  useEffect(() => {
    if (!running) return;
    const step = (now: number) => {
      if (!last.current) last.current = now;
      const dt = (now - last.current) / 1000; last.current = now;
      setT((p) => p + dt);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); last.current = 0; };
  }, [running]);
  const omega = Math.sqrt(k / m);
  const x = A * Math.exp(-b * t) * Math.cos(omega * t);
  const period = (2 * Math.PI) / omega;
  // Draw coils as zig-zag
  const restX = 80, blockX = 260 + x;
  const coils = 14;
  const coilPath = (() => {
    const len = blockX - restX;
    const seg = len / coils;
    let d = `M${restX},150`;
    for (let i = 0; i < coils; i++) {
      const x0 = restX + i * seg;
      d += ` L${x0 + seg / 2},${i % 2 === 0 ? 130 : 170}`;
    }
    d += ` L${blockX},150`;
    return d;
  })();
  return (
    <div className="p-5">
      <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-b from-slate-50 to-white">
        <svg viewBox="0 0 520 220" className="w-full">
          <rect x="60" y="100" width="14" height="100" fill="#475569" />
          <path d={coilPath} fill="none" stroke="#0ea5e9" strokeWidth="3" />
          <rect x={blockX} y="118" width="60" height="64" rx="6" fill="#1d4ed8" />
          <line x1="260" y1="200" x2="260" y2="210" stroke="#94a3b8" />
          <text x="260" y="215" fontSize="10" textAnchor="middle" fill="#64748b">equilibrium</text>
        </svg>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Slider label="Spring constant k (N/m)" value={k} min={5} max={80} step={1} unit="" onChange={setK} />
        <Slider label="Mass m (kg)" value={m} min={0.2} max={5} step={0.1} unit="" onChange={setM} />
        <Slider label="Amplitude A (px)" value={A} min={20} max={140} step={1} unit="" onChange={setA} />
        <Slider label="Damping b" value={b} min={0} max={1.2} step={0.05} unit="" onChange={setB} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="ω" value={`${omega.toFixed(2)} rad/s`} />
        <Stat label="T" value={`${period.toFixed(2)} s`} />
        <Stat label="x(t)" value={`${x.toFixed(1)} px`} />
      </div>
      <div className="mt-3 flex gap-3">
        <button onClick={() => setRunning((r) => !r)} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{running ? "Pause" : "Play"}</button>
        <button onClick={() => setT(0)} className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-brand-deep">Reset</button>
      </div>
    </div>
  );
}

/* ============================ Inclined Plane ============================ */
export function InclinedPlaneSim() {
  const [theta, setTheta] = useState(30);
  const [mu, setMu] = useState(0.1);
  const [m, setM] = useState(2);
  const [running, setRunning] = useState(true);
  const [s, setS] = useState(0); // distance along incline
  const [v, setV] = useState(0);
  const raf = useRef<number | undefined>(undefined);
  const last = useRef<number>(0);
  const g = 9.8;
  useEffect(() => {
    if (!running) return;
    const step = (now: number) => {
      if (!last.current) last.current = now;
      const dt = (now - last.current) / 1000; last.current = now;
      const rad = (theta * Math.PI) / 180;
      const a = g * (Math.sin(rad) - mu * Math.cos(rad));
      setV((prev) => Math.max(0, prev + a * dt));
      setS((prev) => Math.min(220, prev + Math.max(0, v) * dt * 8));
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); last.current = 0; };
  }, [running, theta, mu, v]);
  const rad = (theta * Math.PI) / 180;
  const a = g * (Math.sin(rad) - mu * Math.cos(rad));

  const x0 = 60, y0 = 220;
  const L = 360;
  const x1 = x0 + L * Math.cos(rad);
  const y1 = y0 - L * Math.sin(rad);
  const bx = x0 + s * Math.cos(rad);
  const by = y0 - s * Math.sin(rad);
  return (
    <div className="p-5">
      <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-b from-slate-50 to-white">
        <svg viewBox="0 0 480 260" className="w-full">
          <polygon points={`${x0},${y0} ${x1},${y1} ${x1},${y0}`} fill="#fde68a" stroke="#92400e" strokeWidth="2" />
          <g transform={`translate(${bx} ${by}) rotate(${-theta})`}>
            <rect x="-22" y="-30" width="44" height="30" fill="#1d4ed8" stroke="#1e3a8a" strokeWidth="2" rx="4" />
          </g>
          <text x="80" y="245" fontSize="10" fill="#475569">θ = {theta}°  |  a = {a.toFixed(2)} m/s²</text>
        </svg>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Slider label="Angle θ (°)" value={theta} min={5} max={60} step={1} unit="" onChange={(x) => { setTheta(x); setS(0); setV(0); }} />
        <Slider label="μ (friction)" value={mu} min={0} max={0.8} step={0.02} unit="" onChange={(x) => { setMu(x); setS(0); setV(0); }} />
        <Slider label="Mass (kg)" value={m} min={0.5} max={10} step={0.5} unit="" onChange={setM} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="a" value={`${a.toFixed(2)} m/s²`} />
        <Stat label="Normal N" value={`${(m * g * Math.cos(rad)).toFixed(2)} N`} />
        <Stat label="Friction f" value={`${(mu * m * g * Math.cos(rad)).toFixed(2)} N`} />
      </div>
      <div className="mt-3 flex gap-3">
        <button onClick={() => setRunning((r) => !r)} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{running ? "Pause" : "Play"}</button>
        <button onClick={() => { setS(0); setV(0); }} className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-brand-deep">Reset</button>
      </div>
    </div>
  );
}

/* ============================ 1-D Elastic Collision ============================ */
export function CollisionSim() {
  const [m1, setM1] = useState(2);
  const [m2, setM2] = useState(1);
  const [u1, setU1] = useState(3);
  const [u2, setU2] = useState(-1);
  const [e, setE] = useState(1);   // 1 = elastic, 0 = perfectly inelastic
  const [running, setRunning] = useState(true);
  const stateRef = useRef({ x1: 120, x2: 380, v1: u1, v2: u2, t: 0 });
  const [, force] = useState(0);
  const raf = useRef<number | undefined>(undefined);
  const last = useRef<number>(0);

  useEffect(() => {
    stateRef.current = { x1: 120, x2: 380, v1: u1, v2: u2, t: 0 };
    force((x) => x + 1);
  }, [u1, u2, m1, m2, e]);

  useEffect(() => {
    if (!running) return;
    const step = (now: number) => {
      if (!last.current) last.current = now;
      const dt = (now - last.current) / 1000; last.current = now;
      const s = stateRef.current;
      s.x1 += s.v1 * 40 * dt;
      s.x2 += s.v2 * 40 * dt;
      // Collision when balls overlap (r = 20)
      if (s.x2 - s.x1 < 40 && s.v1 - s.v2 > 0) {
        // Coefficient-of-restitution collision: v1' = (m1·u1 + m2·u2 - m2·e·(u1−u2)) / (m1+m2)
        const v1 = (m1 * s.v1 + m2 * s.v2 - m2 * e * (s.v1 - s.v2)) / (m1 + m2);
        const v2 = (m1 * s.v1 + m2 * s.v2 + m1 * e * (s.v1 - s.v2)) / (m1 + m2);
        s.v1 = v1; s.v2 = v2;
      }
      if (s.x1 < 20) { s.x1 = 20; s.v1 = Math.abs(s.v1); }
      if (s.x2 > 480) { s.x2 = 480; s.v2 = -Math.abs(s.v2); }
      force((x) => x + 1);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); last.current = 0; };
  }, [running, m1, m2, e]);

  const s = stateRef.current;
  const pBefore = m1 * u1 + m2 * u2;
  const pAfter = m1 * s.v1 + m2 * s.v2;
  const keBefore = 0.5 * m1 * u1 * u1 + 0.5 * m2 * u2 * u2;
  const keAfter = 0.5 * m1 * s.v1 * s.v1 + 0.5 * m2 * s.v2 * s.v2;

  return (
    <div className="p-5">
      <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-b from-slate-50 to-white">
        <svg viewBox="0 0 500 180" className="w-full">
          <line x1="10" y1="120" x2="490" y2="120" stroke="#334155" strokeWidth="2" />
          <g>
            <circle cx={s.x1} cy="100" r="20" fill="#1d4ed8" stroke="#1e3a8a" strokeWidth="2" />
            <text x={s.x1} y="105" textAnchor="middle" fontSize="11" fill="white" fontWeight="700">m₁</text>
          </g>
          <g>
            <circle cx={s.x2} cy="100" r={20 * Math.cbrt(m2 / m1)} fill="#dc2626" stroke="#7f1d1d" strokeWidth="2" />
            <text x={s.x2} y="105" textAnchor="middle" fontSize="11" fill="white" fontWeight="700">m₂</text>
          </g>
        </svg>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Slider label="m₁ (kg)" value={m1} min={0.5} max={5} step={0.5} unit="" onChange={setM1} />
        <Slider label="m₂ (kg)" value={m2} min={0.5} max={5} step={0.5} unit="" onChange={setM2} />
        <Slider label="u₁ (m/s)" value={u1} min={-5} max={5} step={0.5} unit="" onChange={setU1} />
        <Slider label="u₂ (m/s)" value={u2} min={-5} max={5} step={0.5} unit="" onChange={setU2} />
        <Slider label="Restitution e" value={e} min={0} max={1} step={0.05} unit="" onChange={setE} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Momentum before" value={`${pBefore.toFixed(2)}`} />
        <Stat label="Momentum after"  value={`${pAfter.toFixed(2)}`} />
        <Stat label="KE before" value={`${keBefore.toFixed(2)} J`} />
        <Stat label="KE after"  value={`${keAfter.toFixed(2)} J`} />
      </div>
      <div className="mt-3 flex gap-3">
        <button onClick={() => setRunning((r) => !r)} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{running ? "Pause" : "Play"}</button>
        <button onClick={() => { stateRef.current = { x1: 120, x2: 380, v1: u1, v2: u2, t: 0 }; force((x) => x + 1); }} className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-brand-deep">Reset</button>
      </div>
    </div>
  );
}
