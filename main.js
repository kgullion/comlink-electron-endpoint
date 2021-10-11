"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.electronEndpoint = void 0;
var comlink_1 = require("comlink");
var electron_1 = require("electron");
var common_1 = require("./common");
function electronEndpoint(port) {
    var listeners = new WeakMap();
    var ep = {
        postMessage: function (message, ports) {
            // shim for comlink proxy
            if (ports === null || ports === void 0 ? void 0 : ports.length) {
                var _a = (0, common_1.packMessage)(message, ports), msg = _a[0], xfers = _a[1];
                port.postMessage(msg, xfers);
            }
            else
                port.postMessage(message, ports);
        },
        addEventListener: function (type, listener) {
            var l = function (_a) {
                var data = _a.data, ports = _a.ports;
                // shim for comlink proxy
                if (ports.length)
                    listener({
                        data: (0, common_1.unpackMessage)(data, ports, electronEndpoint),
                        ports: [],
                    });
                else
                    listener({ data: data, ports: ports });
            };
            port.on('message', l);
            listeners.set(listener, l);
        },
        removeEventListener: function (type, listener) {
            var l = listeners.get(listener);
            if (!l)
                return;
            port.off('message', l);
            listeners.delete(listener);
        },
        start: port.start.bind(port),
    };
    return ep;
}
exports.electronEndpoint = electronEndpoint;
var handler = comlink_1.transferHandlers.get('proxy');
if (handler) {
    handler.serialize = function (obj) {
        var _a = new electron_1.MessageChannelMain(), port1 = _a.port1, port2 = _a.port2;
        (0, comlink_1.expose)(obj, electronEndpoint(port1));
        return [port2, [port2]];
    };
    comlink_1.transferHandlers.set('proxy', handler);
}
