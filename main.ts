import { MessageChannelMain } from 'electron';
import type { MessagePortMain } from 'electron';
import { expose, transferHandlers } from 'comlink';
import { WireValueType, MessageType } from 'comlink/src/protocol';
import type { Endpoint, Message, WireValue } from 'comlink/src/protocol';

type ElectronEventListener = (event: Electron.MessageEvent) => void;
type ElectronEndpoint = {
  postMessage(message: Message, ports: MessagePortMain[]): void;
  addEventListener: (type: string, listener: ElectronEventListener) => void;
  removeEventListener: (type: string, listener: ElectronEventListener) => void;
  start: () => void;
};

// MessagePortMain is not StructuredCloneable but the proxy transferHandler
// relies on being able to pass a MessagePort via the postMessage body.
// Instead, we swap out the passed port for an index into transfers and set the
// message type to a proxy token.

// if val is transferred endpoint, remove it from the WireValue, and mark with
// our own WireValueType (null "SHOULD" be a safe sentinel value for WireValueType)
const proxyToken = null;
function packWireValue(val: WireValue, transfers: MessagePortMain[]) {
  if (val.type !== WireValueType.HANDLER) return val;
  else {
    const index = transfers.findIndex((p) => val.value === p);
    if (index >= 0) {
      val.type = proxyToken as unknown as WireValueType.HANDLER;
      val.value = index;
    }
    return val;
  }
}
// check for proxyToken sentinel value and swap out the index for the endpoint
function unpackWireValue(val: WireValue, transfers: MessagePortMain[]) {
  if (val.type !== (proxyToken as unknown as WireValueType)) return val;
  else {
    val.type = WireValueType.HANDLER;
    val.value = electronEndpoint(transfers[val.value as number]);
    return val;
  }
}

// pack all the transferrables and properly transfer ports
function packMessage(
  message: Message,
  transfers: MessagePortMain[]
): [Message, MessagePortMain[]] {
  if (message.type === MessageType.SET)
    message.value = packWireValue(message.value, transfers);
  else if (
    message.type === MessageType.APPLY ||
    message.type === MessageType.CONSTRUCT
  )
    message.argumentList = message.argumentList.map((v) =>
      packWireValue(v, transfers)
    );

  return [message, transfers];
}
// unpack the transferred ports
function unpackMessage(message: Message, transfers: MessagePortMain[]) {
  if (message.type === MessageType.SET)
    message.value = unpackWireValue(message.value, transfers);
  else if (
    message.type === MessageType.APPLY ||
    message.type === MessageType.CONSTRUCT
  )
    message.argumentList = message.argumentList.map((v) =>
      unpackWireValue(v, transfers)
    );
  return message;
}

// wraps a messagePortMain in the logic required for an electron comlink endpoint
export function electronEndpoint(port: MessagePortMain): Endpoint {
  const listeners = new WeakMap<ElectronEventListener, ElectronEventListener>();
  const ep: ElectronEndpoint = {
    postMessage(message, ports) {
      // shim for comlink proxy
      if (ports?.length) port.postMessage(...packMessage(message, ports));
      else port.postMessage(message, ports);
    },
    addEventListener: (type, listener) => {
      const l = ({ data, ports }: Electron.MessageEvent) => {
        // shim for comlink proxy
        if (ports.length)
          listener({ data: unpackMessage(data, ports), ports: [] });
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

// patch the transferHandler to use electronEndpoint
const handler = transferHandlers.get('proxy');
if (handler) {
  handler.serialize = (obj: unknown) => {
    const { port1, port2 } = new MessageChannelMain();
    expose(obj, electronEndpoint(port1));
    return [port2, [port2 as unknown as Transferable]];
  };
  transferHandlers.set('proxy', handler);
}
