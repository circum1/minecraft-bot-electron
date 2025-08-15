// renderer/snippet.js (formerly commandpanel.js)
(() => {
    // forward
    const forwardBtn = document.getElementById('forwardBtn');
    if (forwardBtn) {
      forwardBtn.addEventListener('click', () => {
        console.log('[UI] Move Forward clicked');
        window.api.send('move-forward');
      });
    }

    const autoFishBtn = document.getElementById('autoFishBtn');
    if (autoFishBtn) {
        autoFishBtn.addEventListener('click', () => {
        window.api.send('autoFish');
      });
    }

    // suicide
    const killBtn = document.getElementById('killBtn');
    if (killBtn) {
      killBtn.addEventListener('click', () => {
        window.api.send('suicide');
      });
    }

    // chat
    const chatBtn   = document.getElementById('chatBtn');
    const chatInput = document.getElementById('chatInput');
    if (chatBtn && chatInput) {
      // send on button click
      chatBtn.addEventListener('click', () => {
        const msg = chatInput.value.trim();
        if (!msg) return;
        console.log('[UI] Chat:', msg);
        window.api.send('chat', msg);
        chatInput.value = '';
      });
      // also send on Enter
      chatInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          chatBtn.click();
        }
      });
    }
  })();
