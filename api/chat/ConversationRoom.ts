import { DurableObject } from 'cloudflare:workers';
import type { Bindings } from '../env';

/**
 * One Durable Object per conversation (keyed by conversation id). It is purely a
 * realtime fan-out layer — D1 remains the source of truth. The Worker persists a
 * message over HTTP, then POSTs it here to broadcast to connected sockets; the
 * DO also relays typing events and tracks presence.
 *
 * Uses the WebSocket Hibernation API (acceptWebSocket/getWebSockets) so idle
 * rooms cost nothing, and is declared as a SQLite class in wrangler.jsonc so it
 * works on the free plan.
 */
export class ConversationRoom extends DurableObject<Bindings> {
  override async fetch(request: Request): Promise<Response> {
    // WebSocket connection from a participant (authorized by the Worker first).
    if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      const userId = request.headers.get('x-user-id') ?? 'unknown';
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ userId });
      this.broadcastPresence();
      return new Response(null, { status: 101, webSocket: client });
    }

    // Internal broadcast from the Worker after a message is persisted to D1.
    if (request.method === 'POST') {
      const payload = await request.text();
      this.broadcast(payload);
      return new Response('ok');
    }

    return new Response('not found', { status: 404 });
  }

  override webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    let data: { type?: string } | null = null;
    try {
      data = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }
    if (data?.type === 'typing') {
      const att = ws.deserializeAttachment() as { userId?: string } | null;
      this.broadcast(JSON.stringify({ type: 'typing', userId: att?.userId ?? null }), ws);
    }
  }

  override webSocketClose(ws: WebSocket): void {
    try {
      ws.close();
    } catch {
      /* already closing */
    }
    this.broadcastPresence();
  }

  override webSocketError(): void {
    this.broadcastPresence();
  }

  private broadcast(payload: string, except?: WebSocket): void {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(payload);
      } catch {
        /* socket gone; presence will reconcile */
      }
    }
  }

  private broadcastPresence(): void {
    const ids = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as { userId?: string } | null;
      if (att?.userId) ids.add(att.userId);
    }
    this.broadcast(JSON.stringify({ type: 'presence', online: [...ids] }));
  }
}
