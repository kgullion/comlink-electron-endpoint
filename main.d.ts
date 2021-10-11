import type { Endpoint } from 'comlink/src/protocol';
import type { MessagePortMain } from 'electron';
export declare function electronEndpoint(port: MessagePortMain): Endpoint;
