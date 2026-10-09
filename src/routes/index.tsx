import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict, isToday, differenceInDays } from "date-fns";
import { Copy, ExternalLink, Menu, Moon, Plus, Search, Sun } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchScript, fetchScripts, scriptToText, type ScriptBody, type ScriptRow } from "@/lib/scripts";
import { generateScript, reviewScript } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Curious Globe — Story Desk" },
      { name: "description", content: "Find the story inside the history. Sourced, Reel-ready scripts for @curioussglobe." },
      { property: "og:title", content: "Curious Globe — Story Desk" },
      { property: "og:description", content: "Find the story inside the history. Sourced, Reel-ready scripts for @curioussglobe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const TIMEOUT_MS = 10 * 60 * 1000;
const PLACEHOLDERS = [
  "The forgotten kingdom that controlled the spice route",
  "Why did the Bronze Age collapse?",
  "The emperor who made one disastrous decision",
  "What daily life was like in ancient Pompeii",
];
const PILLARS: [string, string][] = [
  ["Forgotten History", "The forgotten kingdom that controlled the spice route"],
  ["Mysteries", "What really happened to the lost colony of Roanoke?"],
  ["Empires & Downfalls", "Why did the Bronze Age collapse?"],
  ["Unbelievable True Events", "The Great Molasses Flood of 1919"],
  ["Historical Figures", "The emperor who made one disastrous decision"],
  ["Everyday Life", "What daily life was like in ancient Pompeii"],
];
const CAPTIONS = [
  "Searching credible sources…",
  "Finding the story inside the history…",
  "Checking every fact against its source…",
  "Shaping the hook…",
];
const NOTES = ["Stronger hook", "Shorter", "More suspense", "Simpler words", "Clearer payoff", "Less dramatic, more factual"];

const countWords = (t?: string) => (t ? t.trim().split(/\s+/).filter(Boolean).length : 0);
const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const rel = (d: string | null) => (d ? formatDistanceToNowStrict(new Date(d), { addSuffix: true }) : "");
const domain = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

function useCycle(n: number, ms: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % n), ms);
    return () => clearInterval(t);
  }, [n, ms]);
  return i;
}

function Globe({ spinning, className }: { spinning?: boolean | undefined; className?: string | undefined }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.3" className={cn("text-primary", spinning && "animate-globe", className)} aria-hidden>
      <circle cx="16" cy="16" r="13" />
      <ellipse cx="16" cy="16" rx="6" ry="13" />
      <line x1="16" y1="3" x2="16" y2="29" />
      <line x1="3" y1="16" x2="29" y2="16" />
      <path d="M5 9.5h22M5 22.5h22" />
    </svg>
  );
}

const STATUS: Record<string, { label: string; dot: string; chip: string }> = {
  processing: { label: "Processing", dot: "bg-warning", chip: "border-warning/50 text-warning" },
  ready: { label: "Ready", dot: "bg-success", chip: "border-success/50 text-success" },
  failed: { label: "Failed", dot: "bg-destructive", chip: "border-destructive/50 text-destructive" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, dot: "bg-muted-foreground", chip: "text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider", s.chip)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot, status === "processing" && "animate-pulse")} />
      {s.label}
    </span>
  );
}

function Index() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["scripts"], queryFn: fetchScripts });

  useEffect(() => {
    const saved = localStorage.getItem("cg-theme");
    if (saved === "light") setDark(false);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("cg-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const ch = supabase
      .channel("scripts-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "scripts" }, () => {
        qc.invalidateQueries({ queryKey: ["scripts"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const select = (id: string | null) => {
    setSelectedId(id);
    setMobileOpen(false);
  };
  const anyProcessing = !!list.data?.some((r) => r.status === "processing");

  return (
    <div className="relative z-10 flex min-h-screen font-sans text-foreground">
      <aside className="hidden w-80 shrink-0 border-r bg-sidebar/80 md:block">
        <div className="sticky top-0 h-screen">
          <Archive rows={list.data} loading={list.isLoading} selectedId={selectedId} onSelect={select} />
        </div>
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-80 bg-sidebar p-0">
          <SheetTitle className="sr-only">Story archive</SheetTitle>
          <Archive rows={list.data} loading={list.isLoading} selectedId={selectedId} onSelect={select} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b px-4 py-3 md:px-8">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open story archive">
            <Menu className="h-5 w-5" />
          </Button>
          <Globe spinning={anyProcessing} className="h-7 w-7" />
          <div className="leading-tight">
            <div className="font-serif text-lg font-semibold">Curious Globe</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Story Desk</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => select(null)}>
              <Plus className="h-4 w-4" /> New story
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setDark((d) => !d)} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>
        <main className="flex-1 px-4 py-8 md:px-8 md:py-12">
          {selectedId ? <ScriptView key={selectedId} id={selectedId} /> : <NewScript onCreated={select} />}
        </main>
      </div>
    </div>
  );
}

function Archive({
  rows,
  loading,
  selectedId,
  onSelect,
}: {
  rows: ScriptRow[] | undefined;
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const g: { Today: ScriptRow[]; "This week": ScriptRow[]; Earlier: ScriptRow[] } = { Today: [], "This week": [], Earlier: [] };
    (rows ?? [])
      .filter((r) => r.topic.toLowerCase().includes(q.toLowerCase()))
      .forEach((r) => {
        const d = r.created_at ? new Date(r.created_at) : new Date(0);
        if (isToday(d)) g.Today.push(r);
        else if (differenceInDays(new Date(), d) < 7) g["This week"].push(r);
        else g.Earlier.push(r);
      });
    return g;
  }, [rows, q]);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 p-4">
        <h2 className="font-serif text-xl">Story archive</h2>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search topics" className="h-9 pl-8" aria-label="Search topics" />
        </div>
        <Button className="w-full" onClick={() => onSelect(null)}>
          <Plus className="h-4 w-4" /> New story
        </Button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-6" aria-label="Story archive">
        {loading && [0, 1, 2].map((i) => <Skeleton key={i} className="mx-2 mb-2 h-14" />)}
        {!loading && rows?.length === 0 && <p className="px-3 text-sm text-muted-foreground">No stories yet. Your archive starts with the first topic.</p>}
        {Object.entries(groups).map(([label, items]) =>
          items.length ? (
            <div key={label} className="mb-4">
              <div className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
              {items.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onSelect(r.id)}
                  aria-current={selectedId === r.id ? "true" : undefined}
                  className={cn(
                    "block w-full rounded-r-md border-l-2 border-transparent px-3 py-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selectedId === r.id && "border-primary bg-sidebar-accent",
                  )}
                >
                  <div className="line-clamp-2 font-serif text-[15px] leading-snug">{r.topic}</div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                    <span className={cn("h-1.5 w-1.5 rounded-full", STATUS[r.status]?.dot ?? "bg-muted-foreground")} aria-label={STATUS[r.status]?.label ?? r.status} />
                    {rel(r.created_at)}
                  </div>
                </button>
              ))}
            </div>
          ) : null,
        )}
      </nav>
    </div>
  );
}

function NewScript({ onCreated }: { onCreated: (id: string) => void }) {
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const ph = useCycle(PLACEHOLDERS.length, 3000);
  const submit = async () => {
    if (!topic.trim() || busy) return;
    setBusy(true);
    try {
      const id = await generateScript(topic.trim());
      if (id) onCreated(id);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-[760px] animate-rise pt-[8vh]">
      <Globe className="mb-6 h-12 w-12" />
      <h1 className="font-serif text-4xl leading-[1.1] md:text-6xl">Find the story inside the history.</h1>
      <p className="mt-4 text-lg text-muted-foreground">Type a topic. Get a sourced, Reel-ready script.</p>
      <form
        className="mt-10 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input
          autoFocus
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={PLACEHOLDERS[ph]}
          aria-label="Reel topic"
          className="h-16 bg-card px-5 font-serif text-lg md:text-xl"
        />
        <div className="flex flex-wrap gap-2">
          {PILLARS.map(([label, example]) => (
            <button
              type="button"
              key={label}
              onClick={() => setTopic(example)}
              className="rounded-full border px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {label}
            </button>
          ))}
        </div>
        <Button type="submit" size="lg" className="h-12 px-6" disabled={!topic.trim() || busy}>
          Uncover the story
        </Button>
      </form>
    </div>
  );
}

function ProcessingState() {
  const i = useCycle(CAPTIONS.length, 4000);
  return (
    <div className="space-y-6 animate-rise">
      <div className="flex items-center gap-4 rounded-xl border bg-card p-5">
        <Globe spinning className="h-10 w-10 shrink-0" />
        <div>
          <p key={i} className="animate-rise font-serif text-lg">{CAPTIONS[i]}</p>
          <p className="font-mono text-xs text-muted-foreground">Usually 1–3 minutes.</p>
        </div>
      </div>
      <Skeleton className="h-32 rounded-xl" />
      {[0, 1, 2].map((k) => (
        <div key={k} className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ))}
      <Skeleton className="h-20 rounded-xl" />
    </div>
  );
}

function visualTag(v: string) {
  const t = v.toLowerCase();
  if (t.includes("reconstruction")) return "AI reconstruction — not archival";
  if (t.includes("archival")) return "Archival";
  return null;
}

function ScriptView({ id }: { id: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["script", id],
    queryFn: () => fetchScript(id),
    refetchInterval: (query) => (query.state.data?.status === "processing" ? 5000 : false),
  });
  const [feedback, setFeedback] = useState("");
  const [revising, setRevising] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const ch = supabase
      .channel(`script-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "scripts", filter: `id=eq.${id}` }, (p) => {
        if (p.new && "id" in p.new) qc.setQueryData(["script", id], p.new as ScriptRow);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const row = q.data;
  useEffect(() => {
    if (row && revising !== null && row.version > revising) setRevising(null);
  }, [row, revising]);

  if (q.isLoading) return <div className="mx-auto max-w-[760px]"><Skeleton className="h-40 rounded-xl" /></div>;
  if (!row) return <p className="mx-auto max-w-[760px] text-muted-foreground">This story isn't in the archive.</p>;

  const s = row.script;
  const processing = row.status === "processing";
  const tooLong = processing && row.updated_at && now - new Date(row.updated_at).getTime() > TIMEOUT_MS;

  return (
    <div className="mx-auto flex max-w-[1180px] gap-10">
      <div className="min-w-0 max-w-[760px] flex-1 space-y-8">
        <header className="space-y-3 animate-rise">
          <MetaBar row={row} />
          <h1 className="font-serif text-3xl leading-tight md:text-4xl">{row.topic}</h1>
        </header>

        <div aria-live="polite" className="sr-only">Status: {STATUS[row.status]?.label ?? row.status}</div>

        {processing && !tooLong && <ProcessingState />}

        {tooLong && (
          <div className="flex flex-col gap-3 rounded-xl border border-warning/60 bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-serif text-lg">Taking too long, try again</p>
            <Button variant="outline" onClick={() => generateScript(row.topic)}>Try again</Button>
          </div>
        )}

        {row.status === "failed" && (
          <div className="rounded-xl border border-destructive bg-card p-5">
            <h2 className="font-serif text-xl text-destructive">This one didn't hold up</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{row.error || "Something went wrong while writing this script."}</p>
            <Button className="mt-4" variant="outline" onClick={() => generateScript(row.topic)}>Try again</Button>
          </div>
        )}

        {s && !processing && <Storyboard s={s} />}

        {s && !processing && (
          <form
            className="space-y-3 rounded-xl border bg-card p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!feedback.trim()) return;
              setRevising(row.version);
              reviewScript(row.id, feedback.trim());
            }}
          >
            <h2 className="font-serif text-xl">Give notes for the next draft</h2>
            <div className="flex flex-wrap gap-2">
              {NOTES.map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setFeedback((f) => (f.trim() ? `${f.trim()}\n${n}` : n))}
                  className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {n}
                </button>
              ))}
            </div>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What should change? e.g. open on the decision, not the date."
              rows={4}
              aria-label="Notes for the next draft"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-xs text-muted-foreground" aria-live="polite">
                {revising !== null ? `Revising v${revising} → v${revising + 1}…` : ""}
              </span>
              <Button type="submit" disabled={!feedback.trim()}>Revise script</Button>
            </div>
          </form>
        )}
      </div>

      {s?.hook && !processing && (
        <aside className="hidden w-64 shrink-0 xl:block">
          <div className="sticky top-8">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Reel preview</div>
            <div className="reel-gradient flex aspect-[9/16] flex-col justify-between rounded-2xl border p-5 text-reel-text">
              <div />
              <p className="text-center font-sans text-lg font-semibold leading-snug">{s.hook}</p>
              <p className="text-center font-mono text-xs opacity-80">@curioussglobe</p>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

function MetaBar({ row }: { row: ScriptRow }) {
  const s = row.script;
  const words = s ? countWords(s.hook) + (s.scenes ?? []).reduce((a, sc) => a + countWords(sc.narration), 0) : 0;
  const off = words > 0 && (words < 80 || words > 130);
  return (
    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
      <StatusBadge status={row.status} />
      <span className="rounded-full border px-2 py-0.5">v{row.version}</span>
      {words > 0 && (
        <>
          <span className={cn("rounded-full border px-2 py-0.5", off && "border-warning/60 text-warning")}>{words} words</span>
          <span className={cn("rounded-full border px-2 py-0.5", off && "border-warning/60 text-warning")}>≈ {Math.round(words / 2.5)}s</span>
        </>
      )}
      <span>{rel(row.created_at)}</span>
    </div>
  );
}

function Storyboard({ s }: { s: ScriptBody }) {
  const hookWords = countWords(s.hook);
  let cum = hookWords;
  const scenes = (s.scenes ?? []).map((sc) => {
    const start = cum / 2.5;
    cum += countWords(sc.narration);
    return { ...sc, start };
  });

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };
  const withVisuals = [s.hook ? `Hook: ${s.hook}` : "", ...(s.scenes ?? []).map((sc, i) => `Scene ${sc.scene_number ?? i + 1}\nNarration: ${sc.narration}\nVisual: ${sc.visual_description}`)]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="space-y-8">
      {s.hook && (
        <section className="animate-rise rounded-xl border bg-card p-6 md:p-8">
          <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-brass-ink">Hook · 0:00</div>
          <p className="font-serif text-2xl leading-snug md:text-3xl">“{s.hook}”</p>
        </section>
      )}

      <ol className="space-y-4">
        {scenes.map((sc, i) => {
          const tag = visualTag(sc.visual_description ?? "");
          return (
            <li key={i} className="animate-rise rounded-xl border bg-card p-5" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
              <div className="mb-3 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span className="uppercase tracking-[0.2em]">Frame {String(sc.scene_number ?? i + 1).padStart(2, "0")}</span>
                <span>≈ {fmtTime(sc.start)}</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Narration</div>
                  <p className="font-serif text-lg leading-relaxed">{sc.narration}</p>
                </div>
                <div className="film-frame rounded-lg border bg-raised py-3 pr-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Visual</span>
                    {tag && <span className="rounded border border-primary/50 px-1.5 py-px font-mono text-[10px] text-brass-ink">{tag}</span>}
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{sc.visual_description}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {(s.sources?.length ?? 0) > 0 && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 font-serif text-xl">Sources — verify before publishing</h2>
          <ol className="space-y-3">
            {s.sources!.map((src, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="font-mono text-xs text-brass-ink">[{i + 1}]</span>
                <div className="min-w-0">
                  <p>{src.claim}</p>
                  <a
                    href={src.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 inline-flex max-w-full items-center gap-1 break-all font-mono text-xs text-muted-foreground underline-offset-2 hover:text-brass-ink hover:underline"
                  >
                    {domain(src.source_url)} <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => copy(scriptToText(s))}>
          <Copy className="h-4 w-4" /> Copy voice-over
        </Button>
        <Button variant="outline" onClick={() => copy(withVisuals)}>
          <Copy className="h-4 w-4" /> Copy with visuals
        </Button>
      </div>
    </div>
  );
}
