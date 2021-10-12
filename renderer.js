"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.electronEndpoint = void 0;
// MessagePortMain is not StructuredCloneable but the proxy transferHandler
// relies on being able to pass a MessagePort via the postMessage body.
// Instead, we swap out the passed port for an index into transfers and set the
// message type to a proxy token.
// if val is transferred endpoint, remove it from the WireValue, and mark with
// our own WireValueType (null "SHOULD" be a safe sentinel value for WireValueType)
var proxyToken = null;
function packWireValue(val, transfers) {
    if (transfers && val.type === "HANDLER" /* HANDLER */) {
        var index = transfers.findIndex(function (p) { return val.value === p; });
        if (index >= 0) {
            val.type = proxyToken;
            val.value = index;
        }
    }
    return val;
}
// check for proxyToken sentinel value and swap out the index for the endpoint
function unpackWireValue(val, transfers, electronEndpoint) {
    if (val.type === proxyToken) {
        val.type = "HANDLER" /* HANDLER */;
        val.value = electronEndpoint(transfers[val.value]);
    }
    return val;
}
function isMessage(val) {
    return (val.type === "APPLY" /* APPLY */ ||
        val.type === "CONSTRUCT" /* CONSTRUCT */ ||
        val.type === "ENDPOINT" /* ENDPOINT */ ||
        val.type === "GET" /* GET */ ||
        val.type === "RELEASE" /* RELEASE */ ||
        val.type === "SET" /* SET */);
}
// pack all the transferrables and properly transfer ports
function packMessage(message, transfers) {
    if (isMessage(message)) {
        if (message.type === "SET" /* SET */)
            message.value = packWireValue(message.value, transfers);
        else if (message.type === "APPLY" /* APPLY */ ||
            message.type === "CONSTRUCT" /* CONSTRUCT */)
            message.argumentList = message.argumentList.map(function (v) {
                return packWireValue(v, transfers);
            });
    }
    else {
        message = packWireValue(message, transfers);
    }
    return message;
}
// unpack the transferred ports
function unpackMessage(message, transfers, electronEndpoint) {
    if (isMessage(message)) {
        if (message.type === "SET" /* SET */)
            message.value = unpackWireValue(message.value, transfers, electronEndpoint);
        else if (message.type === "APPLY" /* APPLY */ ||
            message.type === "CONSTRUCT" /* CONSTRUCT */)
            message.argumentList = message.argumentList.map(function (v) {
                return unpackWireValue(v, transfers, electronEndpoint);
            });
    }
    else {
        message = unpackWireValue(message, transfers, electronEndpoint);
    }
    return message;
}
function electronEndpoint(port) {
    var listeners = new WeakMap();
    return {
        postMessage: function (message, ports) {
            // shim for comlink proxy
            message = packMessage(message, ports);
            port.postMessage(message, ports);
        },
        addEventListener: function (type, listener) {
            var l = function (_a) {
                var data = _a.data, ports = _a.ports;
                // shim for comlink proxy
                data = unpackMessage(data, ports, electronEndpoint);
                listener({ data: data, ports: ports });
            };
            port.addEventListener("message", l);
            listeners.set(listener, l);
        },
        removeEventListener: function (type, listener) {
            var l = listeners.get(listener);
            if (!l)
                return;
            port.removeEventListener("message", l);
            listeners.delete(listener);
        },
        start: port.start.bind(port),
    };
}
exports.electronEndpoint = electronEndpoint;
