// main.js
const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron')
const fs = require('fs');
const mineflayer = require('mineflayer');
const viewer = require('prismarine-viewer').mineflayer;

const { pathfinder, Movements, goals: { GoalBlock, GoalNear } } = require('mineflayer-pathfinder');
const Vec3 = require('vec3');

const fishing = require('./fishing')

let yaw = 0;
let pitch = 0;
let bot;

function getAsset(s) {
  return path.join(__dirname, '..', 'renderer', s);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: getAsset('preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  // Load the viewer server URL in first-person mode
  mainWindow.loadURL('http://localhost:3000/?mineflayer');

  mainWindow.webContents.on('did-finish-load', () => {
    // const css = fs.readFileSync(getAsset('style.css'), 'utf8');
    // mainWindow.webContents.insertCSS(css);
    // const snippet = fs.readFileSync(getAsset('snippet.html'), 'utf8')
    //   .replace(/`/g, '\\`')
    //   .replace(/\$\{/g, '\\${');

    mainWindow.webContents.executeJavaScript(`

    // grab references
    const snippet = document.getElementById('command-panel');
    const canvas  = document.querySelector('canvas');

    // a function to shrink the canvas so it never covers snippet
    function adjustCanvas() {
      if (!canvas || !snippet) return;
      const h = snippet.getBoundingClientRect().height;
      // force the canvas box to be full‐width but reduced height
      canvas.style.width  = '100%';
      canvas.style.height = \`calc(100% - \${h}px)\`;
    }

    // run now, and also on future window‐resizes
    window.addEventListener('resize', adjustCanvas);
    adjustCanvas();
    `);
  });

}

function startBot() {
  bot = mineflayer.createBot({
    host: 'localhost',   // Minecraft server host
    port: 25565,         // Minecraft server port
    username: 'Bot'      // Bot username
  });

  bot.once('spawn', () => {
    console.log('✅ Bot spawned, launching viewer');

    bot.loadPlugin(pathfinder);
    // configure default movements (so it knows what blocks it can walk on)
    const mcData = require('minecraft-data')(bot.version);
    let defaultMoves = new Movements(bot, mcData);
    defaultMoves.allowFreeMotion = true;
    bot.pathfinder.setMovements(defaultMoves);

    // Start the viewer server on port 3000 in first-person
    viewer(bot, { firstPerson: true, port: 3000 });
    createWindow();
  });

  let isAttacking = false;

  ipcMain.on('control', (ev, control, state) => {
    // movement as above…
    console.log('IPC control', control, state);
    if (['forward', 'back', 'left', 'right', 'jump', 'sneak', 'sprint'].includes(control)) {
      bot.setControlState(control, state);
      return;
    }

    if (control === 'attack') {
      isAttacking = state;
      if (!state) {
        return;
      }
      const loopAttack = () => {
        if (!isAttacking) {
          return;
        }
        const target = bot.nearestEntity();
        if (target) {
          console.log('attack target', target);
          bot.attack(target);
        } else {
          console.log('swing arm');
          bot.swingArm();
        }
        setTimeout(loopAttack, 200);
      };
      loopAttack();
      return;
    }

    if (control === 'use') {
      if (state === true) {
        bot.activateItem();
      } else {
        bot.deactivateItem();
      }
      return;
    }

    console.warn('Unknown control:', control, state);
  });

  // 4) look (mouse)
  ipcMain.on('look', (ev, dx, dy) => {
    const sensitivity = 0.002
    yaw -= dx * sensitivity
    pitch -= dy * sensitivity

    // clamp vertical look
    const max = Math.PI / 2
    pitch = Math.max(-max, Math.min(max, pitch))

    bot.look(yaw, pitch, true, () => { })
  })

  bot.on('error', err => console.error('Bot error:', err));
  bot.on('end', () => console.log('🔌 Bot connection ended'));
}

ipcMain.on('move-forward', () => {
  console.log("move-forward called")
  let dx = -Math.sin(yaw);
  let dz = -Math.cos(yaw);

  console.log("bot pos:", bot.entity.position);
  console.log("yaw, dx, dz", yaw, dx, dz);
  const dist = 10;
  // compute exact fractional X,Z forward:
  const vec = bot.entity.position.offset(
    dx * dist, 0, dz * dist
  );

  bot.pathfinder.goto(new GoalNear(vec.x, vec.y, vec.z, 1)).then(() => {
    console.log("move finished, new pos:", bot.entity.position);
  }, () => {
    console.log("move failed, new pos:", bot.entity.position);
  });
});

ipcMain.on('suicide', () => {
  console.log("suicide called");
  bot.chat('/kill');
});

app.whenReady().then(startBot);

app.on('window-all-closed', () => {
  app.quit();
});
