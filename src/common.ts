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
function unpackWireValue(
  val: WireValue,
  transfers: MessagePort[],
  electronEndpoint: (port: MessagePort) => Endpoint
) {
  if (val.type !== (proxyToken as unknown as WireValueType)) return val;
  else {
    val.type = WireValueType.HANDLER;
    val.value = electronEndpoint(transfers[val.value as number]);
    return val;
  }
}

// pack all the transferrables and properly transfer ports
export function packMessage(
  message: Message,
  transfers: MessagePort[]
): [Message, MessagePort[]] {
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
export function unpackMessage(
  message: Message,
  transfers: MessagePort[],
  electronEndpoint: (port: MessagePort) => Endpoint
) {
  if (message.type === MessageType.SET)
    message.value = unpackWireValue(message.value, transfers, electronEndpoint);
  else if (
    message.type === MessageType.APPLY ||
    message.type === MessageType.CONSTRUCT
  )
    message.argumentList = message.argumentList.map((v) =>
      unpackWireValue(v, transfers, electronEndpoint)
    );
  return message;
}
