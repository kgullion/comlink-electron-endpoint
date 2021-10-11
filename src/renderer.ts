import type { Endpoint, Message } from 'comlink/src/protocol';

import { packMessage, unpackMessage } from './common';

type ElectronRendererEventListener = (event: {
  data: Message;
  ports?: readonly MessagePort[];
}) => void;
type electronEndpointRenderer = {
  postMessage(message: Message, ports: MessagePort[]): void;
  addEventListener: (
    type: string,
    listener: ElectronRendererEventListener
  ) => void;
  removeEventListener: (
    type: string,
    listener: ElectronRendererEventListener
  ) => void;
  start: () => void;
};
export function electronEndpoint(port: MessagePort): Endpoint {
  const listeners = new WeakMap<
    ElectronRendererEventListener,
    ElectronRendererEventListener
  >();
  const ep: electronEndpointRenderer = {
    postMessage(message, ports) {
      // shim for comlink proxy
      if (ports?.length) port.postMessage(...packMessage(message, ports));
      else port.postMessage(message, ports);
    },
    addEventListener: (type, listener) => {
      const l: ElectronRendererEventListener = ({ data, ports }) => {
        // shim for comlink proxy
        if (ports?.length)
          listener({
            data: unpackMessage(data, ports as MessagePort[], electronEndpoint),
            ports: [],
          });
        else listener({ data });
      };
      port.addEventListener('message', l);
      listeners.set(listener, l);
    },
    removeEventListener: (type, listener) => {
      const l = listeners.get(listener);
      if (!l) return;
      port.removeEventListener('message', l);
      listeners.delete(listener);
    },
    start: port.start.bind(port),
  };

  return ep as unknown as Endpoint;
}
