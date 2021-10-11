"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.electronEndpoint = void 0;
var common_1 = require("./common");
function electronEndpoint(port) {
    var listeners = new WeakMap();
    var ep = {
        postMessage: function (message, ports) {
            // shim for comlink proxy
            if (ports === null || ports === void 0 ? void 0 : ports.length)
                port.postMessage.apply(port, (0, common_1.packMessage)(message, ports));
            else
                port.postMessage(message, ports);
        },
        addEventListener: function (type, listener) {
            var l = function (_a) {
                var data = _a.data, ports = _a.ports;
                // shim for comlink proxy
                if (ports === null || ports === void 0 ? void 0 : ports.length)
                    listener({
                        data: (0, common_1.unpackMessage)(data, ports, electronEndpoint),
                        ports: [],
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
            listeners.delete(listener);
        },
        start: port.start.bind(port),
    };
    return ep;
}
exports.electronEndpoint = electronEndpoint;
