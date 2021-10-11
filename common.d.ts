import type { Endpoint, Message } from 'comlink/src/protocol';
export declare function packMessage(message: Message, transfers: MessagePort[]): [Message, MessagePort[]];
export declare function unpackMessage(message: Message, transfers: MessagePort[], electronEndpoint: (port: MessagePort) => Endpoint): Message;
