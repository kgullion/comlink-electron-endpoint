"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.electronEndpoint = void 0;
var comlink_1 = require("comlink");
var electron_1 = require("electron");
var renderer_1 = require("./renderer");
function electronEndpoint(port) {
    port.addEventListener = port.on.bind(port);
    port.removeEventListener = port.off.bind(port);
    return (0, renderer_1.electronEndpoint)(port);
}
exports.electronEndpoint = electronEndpoint;
var handler = comlink_1.transferHandlers.get("proxy");
if (handler) {
    handler.serialize = function (obj) {
        var _a = new electron_1.MessageChannelMain(), port1 = _a.port1, port2 = _a.port2;
        (0, comlink_1.expose)(obj, electronEndpoint(port1));
        return [port2, [port2]];
    };
    handler.deserialize = function (port) {
        port.start();
        return (0, comlink_1.wrap)(electronEndpoint(port));
    };
    comlink_1.transferHandlers.set("proxy", handler);
}
