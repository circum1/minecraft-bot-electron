// main.js
const repl = require('repl');
const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron')
const fs = require('fs');
const mineflayer = require('mineflayer');
const viaproxy = require('mineflayer-viaproxy')
const viewer = require('prismarine-viewer').mineflayer;

const { pathfinder, Movements, goals: { GoalBlock, GoalNear } } = require('mineflayer-pathfinder');
const Vec3 = require('vec3');

const fishing = require('./fishing')

let mcData;
let yaw = 0;
let pitch = 0;
let bot;
let isAttacking = false;

function getAsset(s) {
  return path.join(__dirname, '..', 'renderer', s);
}

function createWindow() {
  let mainWindow = new BrowserWindow({
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

async function startBot() {
  bot = await viaproxy.createBot({
    host: 'localhost',   // Minecraft server host
    port: 25565,         // Minecraft server port
    username: 'Bot',      // Bot username
    forceViaProxy: true,
    auth: 'offline',
    localAuth: viaproxy.AuthType.NONE
  });

  bot.on('spawn', () => {
    console.log('✅ Bot spawned, launching viewer');

    bot.loadPlugin(pathfinder);
    // configure default movements (so it knows what blocks it can walk on)
    mcData = require('minecraft-data')(bot.version);
    let defaultMoves = new Movements(bot, mcData);
    defaultMoves.allowFreeMotion = true;
    bot.pathfinder.setMovements(defaultMoves);

    // Start the viewer server on port 3000 in first-person
    viewer(bot, { firstPerson: true, port: 3000 });
    createWindow();
  });

  ipcMain.on('control', (ev, control, state) => {
    // movement as above…
    console.log('IPC control', control, state);
    if (['forward', 'back', 'left', 'right', 'jump', 'sneak', 'sprint'].includes(control)) {
      bot.setControlState(control, state);
      return;
    }

    if (control === 'attack') {
      handleAttackButton(state);
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

ipcMain.on('autoFish', () => {
  fishing.autoFish(bot);
});

ipcMain.on('suicide', () => {
  console.log("suicide called");
  bot.chat('/kill');
});

ipcMain.on('chat', (ev, message) => {
  if (!bot) return;

  if (message.startsWith('!')) {
    handleChatCommands(message.slice(1));
  } else {
    bot.chat(message);
  }
});

app.whenReady().then(async function () {
  await startBot();

  const replServer = repl.start({
    prompt: 'bot> ',
    input: process.stdin,
    output: process.stdout
  });
  replServer.context.bot = bot;
  console.log("BOT:", bot)

  replServer.context.showInv = () => {
    const items = bot.inventory.items();
    // Node  console.table is great for tabular data
    console.table(items.map(i => ({
      slot: i.slot,
      name: i.name,
      id: i.type,
      count: i.count
    })));
  };
  console.log('🔎 REPL ready! Type `bot` or `showInv()` at the prompt.');
});

app.on('window-all-closed', () => {
  app.quit();
});


//////////////////////////////////////////////////////////////////
// helper functions
//////////////////////////////////////////////////////////////////


function getAttackSpeed() {
  // base speed
  let total = 4.0;

  // 2) if holding an item that modifies attack-speed, apply that too
  const held = bot.heldItem;
  if (held) {
    // look up the item definition
    const def = mcData.items[held.type];
    if (def && def.attributeModifiers) {
      for (const mod of def.attributeModifiers) {
        if (mod.attributeName === 'generic.attack_speed') {
          total += mod.amount;
        }
      }
    }
  }
  return total;
}

function handleAttackButton(state) {
  async function attackLoop() {
    if (!isAttacking) return;

    {
      const e = bot.nearestEntity();
      console.log("nearest entity:", e.name, "distance:", bot.entity.position.distanceTo(e.position));
    }

    // pick nearest live mob within 3 blocks
    const target = bot.nearestEntity(e =>
      e.type === 'hostile' &&
      bot.entity.position.distanceTo(e.position) <= 7
    );

    let delay = Math.floor(1000 / getAttackSpeed());
    if (target) {
      if (bot.entity.position.distanceTo(target.position) <= 3) {
        console.log('▶️ Attacking', target.name || target.type, 'id=', target.id);
        await bot.attack(target);
      } else {
        console.log('Hostile creature near, but not within attack range, wait...');
        delay = 50;
      }
    } else {
      console.log('No target to attack, try to dig');
      const block = bot.blockAtCursor(4.5);
      if (block && bot.canDigBlock(block)) {
        console.log('▶️ Digging', block.name, 'at', block.position);
        try {
          await bot.dig(block);
        } catch (err) {
          console.log('❌ Failed to dig:', err.message);
        }
      } else {
        console.log('— nothing diggable in sight');
      }
      delay = 100;
    }

    console.log(
      `[attackLoop] waiting ${delay}ms until next swing (speed=${getAttackSpeed().toFixed(2)} atk/s)`
    );
    setTimeout(attackLoop, delay);
  }

  isAttacking = state;
  if (isAttacking) attackLoop();
}

function handleChatCommands(chatmsg) {
  const parts = chatmsg.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  console.log("handleChatCommands() cmd:", cmd, ", args:", args);
  switch (cmd) {
    case 'goto':
      if (args.length !== 1) {
        bot.chat('Usage: !goto <playername>');
      } else {
        gotoPlayer(args[0]);
      }
      break;
    case 'fish':
      if (args.length == 0) {
        fishing.autoFish(bot);
      } else if (args.length === 1 && args[0] === "stop") {
        fishing.stop();
      } else {
        bot.chat('Usage: !fish [stop]');
      }
      break;

    default:
      bot.chat(`❓ Unknown command: ${cmd}`);
  }
}

function gotoPlayer(playerName) {
  const playerInfo = bot.players[playerName];
  if (!playerInfo || !playerInfo.entity) {
    bot.chat(`❌ I don't see a player named ${playerName}`);
    return;
  }
  const { x, y, z } = playerInfo.entity.position;
  bot.chat(`⛏ Going to ${playerName} at (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
  bot.pathfinder.setGoal(new GoalNear(x, y, z, 1));
}
