import { supabase } from "@/integrations/supabase/client";

export type Scene = { scene_number: number; narration: string; visual_description: string };
export type Source = { claim: string; source_url: string };
export type ScriptBody = { hook?: string; scenes?: Scene[]; sources?: Source[] };
export type ScriptStatus = "processing" | "ready" | "failed";

export type ScriptRow = {
  id: string;
  topic: string;
  status: ScriptStatus | string;
  script: ScriptBody | null;
  feedback: string | null;
  error: string | null;
  version: number;
  created_at: string | null;
  updated_at: string | null;
};

export async function fetchScripts(): Promise<ScriptRow[]> {
  const { data, error } = await supabase
    .from("scripts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ScriptRow[];
}

export async function fetchScript(id: string): Promise<ScriptRow | null> {
  const { data, error } = await supabase.from("scripts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as ScriptRow | null;
}

export function scriptToText(s: ScriptBody): string {
  const parts = [s.hook ?? "", ...(s.scenes ?? []).map((sc) => sc.narration)];
  return parts.filter(Boolean).join("\n\n");
}
