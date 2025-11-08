import type { Env, Hono, Schema } from 'hono';
import { createNodeWebSocket, type NodeWebSocket } from '@hono/node-ws';

let websocket: NodeWebSocket;
export const initWs = <E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
) => {
  websocket = createNodeWebSocket({ app });
};

export const upgradeWebSocket = ((...props: Parameters<typeof websocket.upgradeWebSocket>) => {
  if (!websocket) {
    throw new Error('WebSocket is not initialized. Please call initWs(app) first.');
  };

  return websocket.upgradeWebSocket(...props);
}) as typeof websocket.upgradeWebSocket;

export const injectWebSocket: typeof websocket.injectWebSocket = (...props) => {
  if (!websocket) {
    throw new Error('WebSocket is not initialized. Please call initWs(app) first.');
  }

  return websocket.injectWebSocket(...props);
};
