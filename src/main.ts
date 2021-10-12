import { Endpoint, expose, transferHandlers, wrap } from "comlink";
import { MessageChannelMain } from "electron";
import type { MessagePortMain } from "electron";

import { electronEndpoint as rendererEndpoint } from "./renderer";

export function electronEndpoint(port: MessagePortMain): Endpoint {
  (port as any).addEventListener = port.on.bind(port);
  (port as any).removeEventListener = port.off.bind(port);
  return rendererEndpoint(port as any);
}

const handler = transferHandlers.get("proxy");
if (handler) {
  handler.serialize = (obj: unknown) => {
    const { port1, port2 } = new MessageChannelMain();
    expose(obj, electronEndpoint(port1));
    return [port2, [port2 as unknown as Transferable]];
  };
  handler.deserialize = (port: MessagePortMain) => {
    port.start();
    return wrap(electronEndpoint(port));
  };
  transferHandlers.set("proxy", handler);
}
