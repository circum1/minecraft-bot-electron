function freeSlots(bot) {
    let count = 0;
    for (const slot of bot.inventory.slots) {
        if (!slot) count++;
    }
    return count;
}

let autoFishInProgress = false;

async function autoFish(bot) {
    console.log("autoFish called");
    autoFishInProgress = true;
    const mcData = require('minecraft-data')(bot.version);
    const rodId = mcData.itemsByName.fishing_rod.id;

    while (freeSlots(bot) > 0) {
        // 1) ensure we have a rod equipped
        if (!(bot.heldItem && bot.heldItem.name === 'fishing_rod')) {
            const rodItem = bot.inventory.findInventoryItem(rodId, null);
            if (!rodItem) {
                console.log('❌ No fishing rod left—stopping.');
                autoFishInProgress = false;
                return;
            }
            await bot.equip(rodItem, 'hand');
            console.log('🎣 Equipped new rod, rods left:',
                bot.inventory.count(rodId));
        }

        try {
            console.log('⏳ Casting…');
            await bot.fish(); // cast, wait for bite, reel in :contentReference[oaicite:1]{index=1}
            console.log('🐟 Fish caught! Free slots:', freeSlots(bot));
        } catch (err) {
            // e.g. “Fishing cancelled due to calling bot.fish() again”
            console.warn('⚠️ Fishing error:', err.message);
            // let the loop re-equip or exit if rod broke
        }
        if (!autoFishInProgress) {
            console.log('Fishing stopped.');
            return;
        }
        // small delay to avoid spamming too quickly
        await bot.waitForTicks(10);
    }

    autoFishInProgress = false;
    console.log('📦 Inventory full — autoFish stopped.');
}

exports.autoFish = autoFish;
exports.stop = function() {autoFishInProgress = false;}
