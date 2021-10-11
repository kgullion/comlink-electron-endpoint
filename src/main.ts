import { expose, transferHandlers } from 'comlink';
import type { Endpoint, Message } from 'comlink/src/protocol';

import { MessageChannelMain } from 'electron';
import type { MessagePortMain } from 'electron';

import { packMessage, unpackMessage } from './common';

type ElectronMainEventListener = (event: Electron.MessageEvent) => void;
type electronEndpointMain = {
  postMessage(message: Message, ports: MessagePortMain[]): void;
  addEventListener: (type: string, listener: ElectronMainEventListener) => void;
  removeEventListener: (
    type: string,
    listener: ElectronMainEventListener
  ) => void;
  start: () => void;
};
export function electronEndpoint(port: MessagePortMain): Endpoint {
  const listeners = new WeakMap<
    ElectronMainEventListener,
    ElectronMainEventListener
  >();
  const ep: electronEndpointMain = {
    postMessage(message, ports) {
      // shim for comlink proxy
      if (ports?.length) {
        const [msg, xfers] = packMessage(
          message,
          ports as unknown as MessagePort[]
        );
        port.postMessage(msg, xfers as unknown as MessagePortMain[]);
      } else port.postMessage(message, ports);
    },
    addEventListener: (type, listener) => {
      const l = ({ data, ports }: Electron.MessageEvent) => {
        // shim for comlink proxy
        if (ports.length)
          listener({
            data: unpackMessage(
              data,
              ports as unknown as MessagePort[],
              electronEndpoint as any
            ),
            ports: [],
          });
        else listener({ data: data as Message, ports });
      };
      port.on('message', l);
      listeners.set(listener, l);
    },
    removeEventListener: (type, listener) => {
      const l = listeners.get(listener);
      if (!l) return;
      port.off('message', l);
      listeners.delete(listener);
    },
    start: port.start.bind(port),
  };

  return ep as unknown as Endpoint;
}

const handler = transferHandlers.get('proxy');
if (handler) {
  handler.serialize = (obj: unknown) => {
    const { port1, port2 } = new MessageChannelMain();
    expose(obj, electronEndpoint(port1));
    return [port2, [port2 as unknown as Transferable]];
  };
  transferHandlers.set('proxy', handler);
}
