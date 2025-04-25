// renderer/preload.js
const { ipcRenderer } = require('electron');
const fs   = require('fs');
const path = require('path');

// expose a simple API to the page
window.api = {
  setControl: (c, v)          => ipcRenderer.send('control', c, v),
  look:       (dx, dy)        => ipcRenderer.send('look', dx, dy),
  send:       (chan, ...args) => ipcRenderer.send(chan, ...args)
};

window.addEventListener('DOMContentLoaded', () => {
  const base = __dirname; // points at renderer/

  const css = fs.readFileSync(path.join(base, 'style.css'), 'utf8');
  const styleTag = document.createElement('style');
  styleTag.textContent = css;
  document.head.appendChild(styleTag);

  const html = fs.readFileSync(path.join(base, 'commandpanel.html'), 'utf8');
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  require(path.join(base, 'commandpanel.js'));
  require(path.join(base, 'bindings.js'));

  console.log("preload.js DOMContentLoaded finished");
});
