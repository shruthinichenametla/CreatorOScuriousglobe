import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import type { TablesUpdate, Json } from "@/integrations/supabase/types";

const Body = z.object({
  script_id: z.string().uuid(),
  status: z.enum(["ready", "failed"]),
  script: z
    .object({
      hook: z.string().optional(),
      scenes: z.array(z.object({ scene_number: z.number(), narration: z.string(), visual_description: z.string() })).optional(),
      sources: z.array(z.object({ claim: z.string(), source_url: z.string() })).optional(),
    })
    .nullish(),
  error: z.string().nullish(),
});

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const Route = createFileRoute("/api/public/n8n-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["N8N_SHARED_SECRET"];
        const key = request.headers.get("x-api-key") ?? "";
        if (!secret || !safeEqual(key, secret)) return Response.json({ error: "Unauthorized" }, { status: 401 });

        let body: z.infer<typeof Body>;
        try {
          body = Body.parse(await request.json());
        } catch {
          return Response.json({ error: "Invalid body" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin.from("scripts").select("version").eq("id", body.script_id).maybeSingle();
        if (!row) return Response.json({ error: "Not found" }, { status: 404 });

        const update: TablesUpdate<"scripts"> = {
          status: body.status,
          error: body.error ?? null,
          updated_at: new Date().toISOString(),
        };
        if (body.script) update.script = body.script as Json;
        if (body.status === "ready") update.version = row.version + 1;

        const { error } = await supabaseAdmin.from("scripts").update(update).eq("id", body.script_id);
        if (error) return Response.json({ error: "Update failed" }, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
