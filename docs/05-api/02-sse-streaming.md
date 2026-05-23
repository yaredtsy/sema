# SSE streaming

The live channel from the backend to the frontend. One stream per agent run. Carries step events, intermediate updates, the final answer, and a close marker.

## Why SSE (not WebSocket)

| Requirement | SSE | WebSocket |
|---|---|---|
| One-way (server → client) | ✅ native | ✅ but bidirectional you don't need |
| Auto-reconnect with `Last-Event-ID` | ✅ built-in | ❌ manual |
| Plain HTTP, works through any proxy | ✅ | mostly |
| Simple client API (`EventSource`) | ✅ | ws library required |
| Binary frames | ❌ | ✅ |
| Backpressure | ❌ (browser-controlled) | manual |

Our data is small JSON, server → client, and reconnection should be transparent. SSE wins.

## Protocol

`GET /api/v1/events/{run_id}` returns `text/event-stream`.

Each event on the wire is the standard SSE format:

```
id: 7
event: step
data: {"seq":7,"step_idx":2,"node":{...},"decision":{...}}

```

- `id:` is the event sequence number — used by `Last-Event-ID` on reconnect.
- `event:` is the event name (`start`, `step`, `visit`, `answer_start`, `answer_token`, `final`, `error`, `done`).
- `data:` is the JSON payload (one event per line; payload is single-line JSON).
- Blank line terminates the event.

## Lifecycle

```
client                                            server
  │                                                 │
  │  POST /query { tree_id, query }                 │
  │ ──────────────────────────────────────────────▶ │
  │                                                 │
  │             202 { run_id, events_url }          │
  │ ◀────────────────────────────────────────────── │
  │                                                 │
  │  GET /events/{run_id}     (Accept: text/event-stream)
  │ ──────────────────────────────────────────────▶ │
  │                                                 │
  │  event: start    data: {...}                    │
  │ ◀────────────────────────────────────────────── │
  │  event: step     data: {...}                    │
  │ ◀────────────────────────────────────────────── │
  │  event: visit    data: {cursor_id, depth}       │
  │ ◀────────────────────────────────────────────── │
  │  ... (more steps) ...                           │
  │  event: answer_start  data: {}                  │
  │ ◀────────────────────────────────────────────── │
  │  event: answer_token  data: {"text":"..."}      │  (repeated)
  │ ◀────────────────────────────────────────────── │
  │  event: final    data: {"text":"...","stop_reason":"..."}
  │ ◀────────────────────────────────────────────── │
  │  event: done     data: {"totals":{...}}         │
  │ ◀────────────────────────────────────────────── │
  │                                                 │
  │             (server closes)                     │
```

## Reconnect

If the connection drops mid-run, the browser's `EventSource` reconnects automatically and sends `Last-Event-ID: <last_seen_seq>`. The server resumes by replaying any buffered events with `seq > last_seen_seq` and then continuing live.

The event buffer is bounded (last 1000 events per run); a longer disconnection truncates and the client falls back to `GET /runs/{run_id}` for the full state.

## Backend implementation

We use `sse-starlette`'s `EventSourceResponse`. The handler does:

```python
@router.get("/events/{run_id}")
async def stream_events(run_id: str, request: Request, bus: EventBus = Depends(get_bus)):
    last_event_id = int(request.headers.get("last-event-id", "0"))
    async def gen():
        # replay missed events
        for ev in bus.replay(run_id, after=last_event_id):
            yield {"id": ev.seq, "event": ev.name, "data": ev.json()}
        # then live
        async for ev in bus.subscribe(run_id):
            if await request.is_disconnected():
                break
            yield {"id": ev.seq, "event": ev.name, "data": ev.json()}
    return EventSourceResponse(gen(), ping=15)
```

A 15-second keepalive (`ping=15`) prevents idle proxies from killing the connection.

## Backpressure / fan-out

One run can have multiple subscribers (e.g. the chat panel and a separate trace inspector). The `EventBus.subscribe(run_id)` returns an `asyncio.Queue`-backed async iterator per subscriber, with a max queue size — if a subscriber falls behind, we drop *that subscriber*, not the producer.

## Cancellation

When the client closes the connection, `request.is_disconnected()` returns `True` at the next iteration and we exit the generator. The agent loop **is not** automatically cancelled — finish what's started, log a `client_disconnected` event. The user can explicitly cancel via `POST /runs/{run_id}/cancel`.

## Encoding pitfalls

- SSE requires `data:` lines to not contain bare newlines. We `json.dumps(payload)` (single line by default in Python). Do not pretty-print.
- The `data:` value is the JSON; we do *not* base64 anything. Markdown in the `final` event arrives as a single line with `\n` escapes — the frontend's renderer handles it.

## Local testing

```bash
curl -N -H "Accept: text/event-stream" \
  http://localhost:8000/api/v1/events/01HQX...
```

`-N` disables curl's buffering so events appear as they arrive.
