import { env } from "@/lib/env";

export type EventHandler = (event: MessageEvent<string>) => void;

export function subscribeEvents(runId: string, onEvent: EventHandler): EventSource {
  const source = new EventSource(`${env.apiUrl}/events/${runId}`);
  source.onmessage = onEvent;
  source.addEventListener("step", onEvent);
  source.addEventListener("final", onEvent);
  source.addEventListener("error", onEvent);
  return source;
}
