"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unpackMessage = exports.packMessage = void 0;
// MessagePortMain is not StructuredCloneable but the proxy transferHandler
// relies on being able to pass a MessagePort via the postMessage body.
// Instead, we swap out the passed port for an index into transfers and set the
// message type to a proxy token.
// if val is transferred endpoint, remove it from the WireValue, and mark with
// our own WireValueType (null "SHOULD" be a safe sentinel value for WireValueType)
var proxyToken = null;
function packWireValue(val, transfers) {
    if (val.type !== "HANDLER" /* HANDLER */)
        return val;
    else {
        var index = transfers.findIndex(function (p) { return val.value === p; });
        if (index >= 0) {
            val.type = proxyToken;
            val.value = index;
        }
        return val;
    }
}
// check for proxyToken sentinel value and swap out the index for the endpoint
function unpackWireValue(val, transfers, electronEndpoint) {
    if (val.type !== proxyToken)
        return val;
    else {
        val.type = "HANDLER" /* HANDLER */;
        val.value = electronEndpoint(transfers[val.value]);
        return val;
    }
}
// pack all the transferrables and properly transfer ports
function packMessage(message, transfers) {
    if (message.type === "SET" /* SET */)
        message.value = packWireValue(message.value, transfers);
    else if (message.type === "APPLY" /* APPLY */ ||
        message.type === "CONSTRUCT" /* CONSTRUCT */)
        message.argumentList = message.argumentList.map(function (v) {
            return packWireValue(v, transfers);
        });
    return [message, transfers];
}
exports.packMessage = packMessage;
// unpack the transferred ports
function unpackMessage(message, transfers, electronEndpoint) {
    if (message.type === "SET" /* SET */)
        message.value = unpackWireValue(message.value, transfers, electronEndpoint);
    else if (message.type === "APPLY" /* APPLY */ ||
        message.type === "CONSTRUCT" /* CONSTRUCT */)
        message.argumentList = message.argumentList.map(function (v) {
            return unpackWireValue(v, transfers, electronEndpoint);
        });
    return message;
}
exports.unpackMessage = unpackMessage;
