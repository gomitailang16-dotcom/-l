// @ts-nocheck -- dense numeric array code; strict index checks add noise
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Arena, COLORS, REWARD } from "@/lib/arena";
import Arena3D from "@/components/Arena3D";

const KEY = "rl_arena_v1";
export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({ meta: [
    { title: "ゼロから学ぶAI銃撃戦" }, { name: "description", content: "報酬だけで何も知らないAIが撃ち合いを学習していく様子を観察" },
    { property: "og:title", content: "ゼロから学ぶAI銃撃戦" }, { property: "og:description", content: "快楽と不快だけで学習するAIたち" },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Index,
});

function Index() {
  const arena = useRef<Arena | null>(null);
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(1); speedRef.current = speed;
  const [, force] = useState(0);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    let s; try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch {}
    arena.current = new Arena(s);
    force((n) => n + 1);
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(arena.current!.serialize())); setSaved(new Date().toLocaleTimeString()); } catch {} };
    const si = setInterval(save, 1000);
    const ui = setInterval(() => force((n) => n + 1), 250);
    window.addEventListener("beforeunload", save);
    return () => { clearInterval(si); clearInterval(ui); save(); window.removeEventListener("beforeunload", save); };
  }, []);

  const A = arena.current;
  const reset = () => { if (!confirm("学習データを全部消して最初からやり直しますか？")) return; localStorage.removeItem(KEY); arena.current = new Arena(); };
  const exportData = () => {
    const blob = new Blob([JSON.stringify(arena.current!.serialize())], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `arena-step${arena.current!.step}.json`; a.click();
  };

  return (
    <main className="min-h-screen bg-background text-foreground font-mono p-3 md:p-6">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-primary">ZERO//ARENA</h1>
          <p className="text-xs text-muted-foreground">何も教えていない4体のAI。報酬だけで学習中。</p>
        </div>
        <div className="text-xs text-muted-foreground">step {A?.step.toLocaleString()} ・ 自動保存 {saved}</div>
      </header>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,600px)_1fr]">
        <div className="w-full aspect-square max-h-[60vh] lg:max-h-none overflow-hidden rounded-md border border-border bg-card">{A && <Arena3D arenaRef={arena} speedRef={speedRef} />}</div>
        <section className="space-y-3">
          <p className="text-[11px] text-muted-foreground">指でドラッグ: 回転 / ピンチ: ズーム</p>
          <div className="flex flex-wrap gap-2">
            {[1, 5, 20, 100].map((s) => (
              <button key={s} onClick={() => setSpeed(s)} className={`px-3 py-1 rounded border text-sm ${speed === s ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>×{s}</button>
            ))}
            <button onClick={exportData} className="px-3 py-1 rounded border border-border text-sm">書き出し</button>
            <button onClick={reset} className="px-3 py-1 rounded border border-destructive text-destructive text-sm">リセット</button>
          </div>
          <div className="text-xs text-muted-foreground rounded border border-border p-2">
            快楽: 命中 +{REWARD.hit} / 撃破 +{REWARD.kill}　不快: 被弾 {REWARD.hurt} / 死亡 {REWARD.die}<br />
            AIが受け取るのは意味のない数字の並び（目の光線）と報酬だけ。行動も番号0〜5としか知らない。
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">{A?.agents.map((ag) => {
            const h = ag.history.slice(-50); const avg = h.length ? h.reduce((a, b) => a + b, 0) / h.length : 0;
            return (
              <div key={ag.id} className="rounded border border-border bg-card p-2 text-xs">
                <div className="flex justify-between"><b style={{ color: COLORS[ag.id] }}>AI-{ag.id}</b>
                  <span>撃破 {ag.kills} ・ 死亡 {ag.deaths} ・ 命中 {ag.hits}</span></div>
                <div className="mt-1 flex gap-2 items-center"><span className="w-10">快楽</span><div className="h-2 flex-1 bg-muted rounded"><div className="h-2 rounded bg-primary" style={{ width: `${Math.min(100, ag.pleasure * 33)}%` }} /></div></div>
                <div className="mt-1 flex gap-2 items-center"><span className="w-10">不快</span><div className="h-2 flex-1 bg-muted rounded"><div className="h-2 rounded bg-destructive" style={{ width: `${Math.min(100, ag.pain * 33)}%` }} /></div></div>
                <div className="mt-1 flex gap-1 items-end h-8">{(ag.last ?? []).map((p: number, i: number) => <div key={i} className="flex-1 bg-accent" style={{ height: `${p * 100}%` }} title={`行動${i}`} />)}</div>
                <Spark data={ag.history} />
                <div className="text-muted-foreground">直近50ライフの平均報酬: {avg.toFixed(1)}</div>
              </div>
            );
          })}</div>
          <div className="text-xs space-y-0.5 text-muted-foreground">{A?.log.map((l, i) => <div key={i}>{l}</div>)}</div>
        </section>
      </div>
    </main>
  );
}

function Spark({ data }: { data: number[] }) {
  if (data.length < 2) return <div className="h-8 text-muted-foreground">まだ死亡記録なし</div>;
  const mn = Math.min(...data), mx = Math.max(...data), r = mx - mn || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - ((v - mn) / r) * 30}`).join(" ");
  return <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full mt-1 stroke-primary fill-none"><polyline points={pts} strokeWidth={1} vectorEffect="non-scaling-stroke" /></svg>;
}

