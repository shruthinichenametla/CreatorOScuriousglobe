import { toast } from "sonner";

export async function generateScript(topic: string): Promise<string | null> {
  void topic;
  toast("Backend not connected yet");
  return null;
}

export async function reviewScript(id: string, feedback: string): Promise<void> {
  void id;
  void feedback;
  toast("Backend not connected yet");
}
