"use strict";
exports.__esModule = true;
exports.electronEndpoint = void 0;
var protocol_1 = require("comlink/src/protocol");
// MessagePortMain is not StructuredCloneable but the proxy transferHandler
// relies on being able to pass a MessagePort via the postMessage body.
// Instead, we swap out the passed port for an index into transfers and set the
// message type to a proxy token.
// if val is transferred endpoint, remove it from the WireValue, and mark with
// our own WireValueType (null "SHOULD" be a safe sentinel value for WireValueType)
var proxyToken = null;
function packWireValue(val, transfers) {
    if (val.type !== protocol_1.WireValueType.HANDLER)
        return val;
    var index = transfers.findIndex(function (p) { return val.value === p; });
    if (index >= 0) {
        val.type = proxyToken;
        val.value = index;
    }
    return val;
}
// check for proxyToken sentinel value and swap out the index for the endpoint
function unpackWireValue(val, transfers) {
    if (val.type !== proxyToken)
        return val;
    val.type = protocol_1.WireValueType.HANDLER;
    val.value = electronEndpoint(transfers[val.value]);
    return val;
}
// pack all the transferrables and properly transfer ports
function packMessage(message, transfers) {
    if (message.type === protocol_1.MessageType.SET)
        message.value = packWireValue(message.value, transfers);
    else if (message.type === protocol_1.MessageType.APPLY ||
        message.type === protocol_1.MessageType.CONSTRUCT)
        message.argumentList = message.argumentList.map(function (v) {
            return packWireValue(v, transfers);
        });
    return [message, transfers];
}
// unpack the transferred ports
function unpackMessage(message, transfers) {
    if (message.type === protocol_1.MessageType.SET)
        message.value = unpackWireValue(message.value, transfers);
    else if (message.type === protocol_1.MessageType.APPLY ||
        message.type === protocol_1.MessageType.CONSTRUCT)
        message.argumentList = message.argumentList.map(function (v) {
            return unpackWireValue(v, transfers);
        });
    return message;
}
// wraps a messagePort in the logic required for a comlink endpoint
function electronEndpoint(port) {
    var listeners = new WeakMap();
    var ep = {
        postMessage: function (message, ports) {
            // shim for comlink proxy
            if (ports === null || ports === void 0 ? void 0 : ports.length)
                port.postMessage.apply(port, packMessage(message, ports));
            else
                port.postMessage(message, ports);
        },
        addEventListener: function (type, listener) {
            var l = function (_a) {
                var data = _a.data, ports = _a.ports;
                // shim for comlink proxy
                if (ports === null || ports === void 0 ? void 0 : ports.length)
                    listener({
                        data: unpackMessage(data, ports),
                        ports: []
                    });
                else
                    listener({ data: data });
            };
            port.addEventListener('message', l);
            listeners.set(listener, l);
        },
        removeEventListener: function (type, listener) {
            var l = listeners.get(listener);
            if (!l)
                return;
            port.removeEventListener('message', l);
            listeners["delete"](listener);
        },
        start: port.start.bind(port)
    };
    return ep;
}
exports.electronEndpoint = electronEndpoint;