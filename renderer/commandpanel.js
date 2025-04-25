(() => {
    let btn = document.getElementById('forwardBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        console.log('[UI] Move Forward clicked');
        window.api.send('move-forward');
    });

    btn = document.getElementById('killBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        window.api.send('suicide');
    });
})();
