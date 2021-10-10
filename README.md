# Comlink Electron Endpoint

Makes [Electron MessagePortMain](https://www.electronjs.org/docs/api/message-port-main) enjoyable.

## Example

**renderer.js**

```javascript
import * as Comlink from "comlink"
import { ipcRenderer } from "electron";
import { electronEndpoint } from "comlink-electron-endpoint/renderer";

async function init() {
  // Create MessagePorts
  const { port1, port2 } = new MessageChannel();

  // Send one end to the main process
  ipcRenderer.postMessage('comlink-port', null, [port1]);

  // create an electronEndpoint from the other end
  const endpoint = electronEndpoint(port2);

  // wrap the other port to proxy the remote object
  const obj = Comlink.wrap(port2);

  // call functions on remote object
  alert(`Counter: ${await obj.counter}`);
  await obj.inc();
  alert(`Counter: ${await obj.counter}`);
}
init();
```

**main.js**

```javascript
import * as Comlink from 'comlink';
import { ipcMain } from 'electron';
import { electronEndpoint } from 'comlink-electron-endpoint/main';

ipcMain.on('port', (event) => {
  // object to be exposed to renderer
  const obj = {
    counter: 0,
    inc() {
      this.counter++;
    },
  };

  // When we receive a MessagePort in the main process, it becomes a
  // MessagePortMain.
  const port = event.ports[0];

  // create the endpoint for comlink and expose obj
  const endpoint = electronEndpoint(port);
  Comlink.expose(obj, endpoint);
});
```

## Additional Resources
[Comlink API](https://github.com/GoogleChromeLabs/comlink#api)

[Electron MessagePortMain Tutorial](https://www.electronjs.org/docs/tutorial/message-ports)