import { MessageType, WireValueType } from "comlink/src/protocol";
import type { Endpoint, Message, WireValue } from "comlink/src/protocol";

// MessagePortMain is not StructuredCloneable but the proxy transferHandler
// relies on being able to pass a MessagePort via the postMessage body.
// Instead, we swap out the passed port for an index into transfers and set the
// message type to a proxy token.

// if val is transferred endpoint, remove it from the WireValue, and mark with
// our own WireValueType (null "SHOULD" be a safe sentinel value for WireValueType)
const proxyToken = null as unknown as WireValueType.HANDLER;
function packWireValue(val: WireValue, transfers: Transferable[] | undefined) {
  if (transfers && val.type === WireValueType.HANDLER) {
    const index = transfers.findIndex((p) => val.value === p);
    if (index >= 0) {
      val.type = proxyToken;
      val.value = index;
    }
  }
  return val;
}

// check for proxyToken sentinel value and swap out the index for the endpoint
function unpackWireValue(
  val: WireValue,
  transfers: Transferable[] | undefined,
  electronEndpoint: (port: MessagePort) => Endpoint
) {
  if (val.type === proxyToken) {
    val.type = WireValueType.HANDLER;
    val.value = electronEndpoint(
      transfers![val.value as number] as MessagePort
    );
  }
  return val;
}

function isMessage(val: Message | WireValue): val is Message {
  return (
    val.type === MessageType.APPLY ||
    val.type === MessageType.CONSTRUCT ||
    val.type === MessageType.ENDPOINT ||
    val.type === MessageType.GET ||
    val.type === MessageType.RELEASE ||
    val.type === MessageType.SET
  );
}

// pack all the transferrables and properly transfer ports
function packMessage(
  message: Message | WireValue,
  transfers: Transferable[] | undefined
) {
  if (isMessage(message)) {
    if (message.type === MessageType.SET)
      message.value = packWireValue(message.value, transfers);
    else if (
      message.type === MessageType.APPLY ||
      message.type === MessageType.CONSTRUCT
    )
      message.argumentList = message.argumentList.map((v) =>
        packWireValue(v, transfers)
      );
  } else {
    message = packWireValue(message, transfers);
  }

  return message;
}
// unpack the transferred ports
function unpackMessage(
  message: Message | WireValue,
  transfers: Transferable[] | undefined,
  electronEndpoint: (port: MessagePort) => Endpoint
) {
  if (isMessage(message)) {
    if (message.type === MessageType.SET)
      message.value = unpackWireValue(
        message.value,
        transfers,
        electronEndpoint
      );
    else if (
      message.type === MessageType.APPLY ||
      message.type === MessageType.CONSTRUCT
    )
      message.argumentList = message.argumentList.map((v) =>
        unpackWireValue(v, transfers, electronEndpoint)
      );
  } else {
    message = unpackWireValue(message, transfers, electronEndpoint);
  }
  return message;
}

export function electronEndpoint(port: MessagePort): Endpoint {
  const listeners = new WeakMap();
  return {
    postMessage(message, ports) {
      // shim for comlink proxy
      message = packMessage(message, ports);
      port.postMessage(message, ports as any);
    },
    addEventListener: (type, listener: any) => {
      const l = ({ data, ports }: any) => {
        // shim for comlink proxy
        data = unpackMessage(data, ports, electronEndpoint);
        listener({ data, ports });
      };
      port.addEventListener("message", l);
      listeners.set(listener, l);
    },
    removeEventListener: (type, listener) => {
      const l = listeners.get(listener);
      if (!l) return;
      port.removeEventListener("message", l);
      listeners.delete(listener);
    },
    start: port.start.bind(port),
  };
}
