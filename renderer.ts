import { MessageType, WireValueType } from 'comlink/src/protocol';
import type { Endpoint, Message, WireValue } from 'comlink/src/protocol';

// MessagePortMain is not StructuredCloneable but the proxy transferHandler
// relies on being able to pass a MessagePort via the postMessage body.
// Instead, we swap out the passed port for an index into transfers and set the
// message type to a proxy token.

// if val is transferred endpoint, remove it from the WireValue, and mark with
// our own WireValueType (null "SHOULD" be a safe sentinel value for WireValueType)
const proxyToken = null;
function packWireValue(val: WireValue, transfers: MessagePort[]) {
  if (val.type !== WireValueType.HANDLER) return val;

  const index = transfers.findIndex((p) => val.value === p);
  if (index >= 0) {
    val.type = proxyToken as unknown as WireValueType.HANDLER;
    val.value = index;
  }
  return val;
}
// check for proxyToken sentinel value and swap out the index for the endpoint
function unpackWireValue(val: WireValue, transfers: MessagePort[]) {
  if (val.type !== (proxyToken as unknown as WireValueType)) return val;
  val.type = WireValueType.HANDLER;
  val.value = electronEndpoint(transfers[val.value as number]);
  return val;
}
// pack all the transferrables and properly transfer ports
function packMessage(
  message: Message,
  transfers: MessagePort[]
): [message: Message, transfers: MessagePort[]] {
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
function unpackMessage(message: Message, transfers: MessagePort[]) {
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

type ElectronEventListener = (event: {
  data: Message;
  ports?: readonly MessagePort[];
}) => void;
type ElectronEndpoint = {
  postMessage(message: Message, ports: MessagePort[]): void;
  addEventListener: (type: string, listener: ElectronEventListener) => void;
  removeEventListener: (type: string, listener: ElectronEventListener) => void;
  start: () => void;
};

// wraps a messagePort in the logic required for a comlink endpoint
export function electronEndpoint(port: MessagePort): Endpoint {
  const listeners = new WeakMap<ElectronEventListener, ElectronEventListener>();
  const ep: ElectronEndpoint = {
    postMessage(message, ports) {
      // shim for comlink proxy
      if (ports?.length) port.postMessage(...packMessage(message, ports));
      else port.postMessage(message, ports);
    },
    addEventListener: (type, listener) => {
      const l: ElectronEventListener = ({ data, ports }) => {
        // shim for comlink proxy
        if (ports?.length)
          listener({
            data: unpackMessage(data, ports as MessagePort[]),
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
