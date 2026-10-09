import { toast } from "sonner";
import { generateScriptFn, reviewScriptFn } from "./n8n.functions";

function msg(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  return m.includes("too_small") || m.includes("too_big") ? "Topic must be 3–300 characters" : m;
}

export async function generateScript(topic: string): Promise<string | null> {
  try {
    const { script_id } = await generateScriptFn({ data: { topic } });
    return script_id;
  } catch (e) {
    toast.error(msg(e));
    return null;
  }
}

export async function reviewScript(id: string, feedback: string): Promise<boolean> {
  try {
    await reviewScriptFn({ data: { script_id: id, feedback } });
    return true;
  } catch (e) {
    toast.error(msg(e));
    return false;
  }
}
