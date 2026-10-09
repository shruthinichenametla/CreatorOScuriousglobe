import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

function callbackUrl() {
  const origin = new URL(getRequest().url).origin;
  return `${origin}/api/public/n8n-callback`;
}

async function postToN8n(url: string, body: unknown) {
  const secret = process.env["N8N_SHARED_SECRET"];
  if (!url || !secret) throw new Error("n8n is not configured yet");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": secret },
      body: JSON.stringify(body),
    });
    return res.ok ? null : `Could not reach n8n (HTTP ${res.status})`;
  } catch {
    return "Could not reach n8n (network error)";
  }
}

export const generateScriptFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ topic: z.string().trim().min(3).max(300) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("scripts")
      .insert({ topic: data.topic, status: "processing" })
      .select("id")
      .single();
    if (error || !row) throw new Error("Could not save the topic");
    const fail = await postToN8n(process.env["N8N_GENERATE_URL"] ?? "", {
      script_id: row.id,
      topic: data.topic,
      callback_url: callbackUrl(),
    });
    if (fail) {
      await supabaseAdmin.from("scripts").update({ status: "failed", error: fail, updated_at: new Date().toISOString() }).eq("id", row.id);
    }
    return { script_id: row.id };
  });

export const reviewScriptFn = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ script_id: z.string().uuid(), feedback: z.string().trim().min(1).max(5000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("scripts").select("*").eq("id", data.script_id).maybeSingle();
    if (!row) throw new Error("Script not found");
    if (row.status === "processing" || row.script == null) throw new Error("This script is still being written");
    await supabaseAdmin
      .from("scripts")
      .update({ status: "processing", feedback: data.feedback, error: null, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    const fail = await postToN8n(process.env["N8N_FEEDBACK_URL"] ?? "", {
      script_id: row.id,
      topic: row.topic,
      feedback: data.feedback,
      current_script: row.script,
      callback_url: callbackUrl(),
    });
    if (fail) {
      await supabaseAdmin.from("scripts").update({ status: "failed", error: fail, updated_at: new Date().toISOString() }).eq("id", row.id);
    }
    return { ok: true };
  });
