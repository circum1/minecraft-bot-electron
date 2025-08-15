// renderer/bindings.js
(() => {
    const api = window.api;
    const canvas = document.querySelector('canvas');
    if (!canvas) {
        console.log("error: no canvas");
        return;
    }

    function isLocked() {
        return document.pointerLockElement === canvas
    }

    // keyboard → controlState
    const keyDownMap = {
        KeyW: ['forward', true],
        KeyS: ['back', true],
        KeyA: ['left', true],
        KeyD: ['right', true],
        Space: ['jump', true],
        ShiftLeft: ['sneak', true],
        ControlLeft: ['sprint', true]
    };
    const keyUpMap = Object.fromEntries(
        Object.entries(keyDownMap).map(([k, [c, _]]) => [k, [c, false]])
    );
    document.addEventListener('keydown', e => {
        if (!isLocked()) return;
        const m = keyDownMap[e.code];
        if (m) {
            e.preventDefault();
            console.log("keydown ev", e)
            api.setControl(m[0], m[1]);
        }
    });
    document.addEventListener('keyup', e => {
        if (!isLocked()) return;
        const m = keyUpMap[e.code];
        if (m) {
            e.preventDefault();
            api.setControl(m[0], m[1]);
        }
    });

    // pointer-lock on canvas mousedown, plus attack/use
    canvas.addEventListener('mousedown', e => {
        if (e.button === 0 && !isLocked()) {
            canvas.requestPointerLock();
            e.preventDefault();
            return;
        }
        if (!isLocked()) return;
        e.preventDefault();
        if (e.button === 0) api.setControl('attack', true);
        if (e.button === 2) api.setControl('use', true);
    });
    canvas.addEventListener('mouseup', e => {
        if (!isLocked()) return;
        e.preventDefault();
        if (e.button === 0) api.setControl('attack', false);
        if (e.button === 2) api.setControl('use', false);
    });
    canvas.addEventListener('contextmenu', e => {
        if (isLocked()) e.preventDefault();
    });

    // mouse-move → look
    document.addEventListener('mousemove', e => {
        if (isLocked()) {
            api.look(e.movementX, e.movementY);
        }
    });
})();
