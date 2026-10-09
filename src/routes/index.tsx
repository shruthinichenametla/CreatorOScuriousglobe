import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, Copy, ExternalLink, Loader2, Menu, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchScript, fetchScripts, scriptToText, type ScriptRow } from "@/lib/scripts";
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
      { title: "Creator OS — Reel scripts for @curioussglobe" },
      { name: "description", content: "Research-backed Instagram Reel script generator for @curioussglobe." },
      { property: "og:title", content: "Creator OS — Reel scripts for @curioussglobe" },
      { property: "og:description", content: "Research-backed Instagram Reel script generator for @curioussglobe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const TIMEOUT_MS = 10 * 60 * 1000;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    processing: "bg-warning/15 text-warning-foreground dark:text-warning border-warning/40",
    ready: "bg-success/15 text-success border-success/40",
    failed: "bg-destructive/15 text-destructive border-destructive/40",
  };
  const label = status === "processing" ? "Processing" : status === "ready" ? "Ready" : status === "failed" ? "Failed" : status;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", map[status] ?? "bg-muted text-muted-foreground")}>
      {status === "processing" && <Loader2 className="h-3 w-3 animate-spin" />}
      {label}
    </span>
  );
}

function rel(d: string | null) {
  return d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : "";
}

function Index() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["scripts"], queryFn: fetchScripts });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

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

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="p-4">
        <div className="mb-4 font-display text-lg font-semibold tracking-tight">
          Creator<span className="text-primary">OS</span>
          <div className="text-xs font-normal text-muted-foreground">@curioussglobe</div>
        </div>
        <Button className="w-full" onClick={() => select(null)}>
          <Plus className="h-4 w-4" /> New script
        </Button>
      </div>
      <div className="px-4 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">History</div>
      <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
        {list.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="mx-2 h-12" />)}
        {list.data?.length === 0 && <p className="px-2 text-sm text-muted-foreground">No scripts yet.</p>}
        {list.data?.map((r) => (
          <button
            key={r.id}
            onClick={() => select(r.id)}
            className={cn(
              "w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-sidebar-accent",
              selectedId === r.id && "bg-sidebar-accent",
            )}
          >
            <div className="truncate text-sm font-medium">{r.topic}</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <StatusBadge status={r.status} />
              <span className="text-xs text-muted-foreground">{rel(r.created_at)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background font-sans text-foreground">
      <aside className="hidden w-72 shrink-0 border-r bg-sidebar text-sidebar-foreground md:block">
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetTitle className="sr-only">History</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>
      <main className="flex-1">
        <div className="flex items-center gap-2 border-b p-3 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open history">
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-display font-semibold">Creator<span className="text-primary">OS</span></span>
        </div>
        <div className="mx-auto max-w-3xl px-4 py-8 md:py-14">
          {selectedId ? <ScriptView key={selectedId} id={selectedId} /> : <NewScript onCreated={select} />}
        </div>
      </main>
    </div>
  );
}

function NewScript({ onCreated }: { onCreated: (id: string) => void }) {
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
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
    <div className="pt-[12vh]">
      <h1 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">
        What should the Reel be about?
      </h1>
      <p className="mt-3 text-muted-foreground">Drop a topic. Get a researched, scene-by-scene script with sources.</p>
      <form
        className="mt-8 flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input
          autoFocus
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Why octopuses have three hearts"
          className="h-14 text-base md:text-lg"
        />
        <Button type="submit" size="lg" className="h-14 px-6" disabled={!topic.trim() || busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generate script
        </Button>
      </form>
    </div>
  );
}

function ScriptView({ id }: { id: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["script", id],
    queryFn: () => fetchScript(id),
    refetchInterval: (query) => (query.state.data?.status === "processing" ? 5000 : false),
  });
  const [feedback, setFeedback] = useState("");
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

  if (q.isLoading) return <Skeleton className="h-40" />;
  const row = q.data;
  if (!row) return <p className="text-muted-foreground">Script not found.</p>;

  const s = row.script;
  const processing = row.status === "processing";
  const tooLong = processing && row.updated_at && now - new Date(row.updated_at).getTime() > TIMEOUT_MS;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={row.status} />
          <span className="text-xs font-medium text-muted-foreground">v{row.version}</span>
          <span className="text-xs text-muted-foreground">· {rel(row.created_at)}</span>
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{row.topic}</h1>
      </header>

      {processing && !tooLong && (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Researching and writing... usually 1–3 minutes.
          </p>
          <Skeleton className="h-24" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      )}

      {tooLong && (
        <div className="flex flex-col gap-3 rounded-xl border border-warning/50 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">Taking too long, try again</p>
          <Button variant="outline" onClick={() => generateScript(row.topic)}>Try again</Button>
        </div>
      )}

      {row.status === "failed" && (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-destructive sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm">{row.error || "Something went wrong."}</p>
          </div>
          <Button variant="destructive" onClick={() => generateScript(row.topic)}>Try again</Button>
        </div>
      )}

      {s && !processing && (
        <>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(scriptToText(s));
                toast.success("Script copied");
              }}
            >
              <Copy className="h-4 w-4" /> Copy script
            </Button>
          </div>
          {s.hook && (
            <section className="rounded-2xl border bg-accent p-6">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-primary">Hook</div>
              <p className="font-display text-xl font-semibold leading-snug md:text-2xl">{s.hook}</p>
            </section>
          )}
          <div className="space-y-3">
            {(s.scenes ?? []).map((sc, i) => (
              <section key={i} className="flex gap-4 rounded-xl border bg-card p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {sc.scene_number ?? i + 1}
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">{sc.narration}</p>
                  <p className="text-sm text-muted-foreground">{sc.visual_description}</p>
                </div>
              </section>
            ))}
          </div>
          {(s.sources?.length ?? 0) > 0 && (
            <section>
              <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Sources</h2>
              <ul className="space-y-2">
                {s.sources!.map((src, i) => (
                  <li key={i} className="text-sm">
                    <span>{src.claim}</span>{" "}
                    <a href={src.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-primary underline-offset-2 hover:underline">
                      {src.source_url} <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {s && !processing && (
        <form
          className="space-y-3 rounded-xl border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (feedback.trim()) reviewScript(row.id, feedback.trim());
          }}
        >
          <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What should change?" rows={3} />
          <div className="flex justify-end">
            <Button type="submit" disabled={!feedback.trim()}>Review script</Button>
          </div>
        </form>
      )}
    </div>
  );
}
