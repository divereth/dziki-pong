(() => {
  if (!['http:', 'https:'].includes(location.protocol)) return;
  const button = document.getElementById('install');
  const notice = document.getElementById('notice');
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let prompt;
  if (button && ios && !standalone()) button.hidden = false;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); prompt = event;
    if (button && !standalone()) button.hidden = false;
  });
  button?.addEventListener('click', async () => {
    if (prompt) {
      const pending = prompt; prompt = null; button.hidden = true;
      await pending.prompt(); await pending.userChoice;
    } else if (ios && notice) notice.textContent = 'Install: open Share, then Add to Home Screen.';
  });
  window.addEventListener('appinstalled', () => { prompt = null; if (button) button.hidden = true; });
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  window.addEventListener('load', async () => {
    let controller = navigator.serviceWorker.controller, updatePending = false, reloading = false;
    const updateButton = document.createElement('button');
    updateButton.id = 'update-game'; updateButton.type = 'button'; updateButton.hidden = true;
    updateButton.textContent = 'Update game';
    button?.insertAdjacentElement('afterend', updateButton);
    updateButton.addEventListener('click', () => location.reload());
    const reloadAtTitle = () => {
      if (!updatePending || reloading || document.getElementById('title-screen')?.hidden !== false) return;
      reloading = true; location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // A running page keeps its already-imported modules even after its worker
      // updates. Remember that update until a safe reload, rather than losing it.
      if (controller) {
        updatePending = true; updateButton.hidden = false;
        if (notice) notice.textContent = 'Update ready. Use Update game to reload, or finish your run first.';
        reloadAtTitle();
      }
      controller = navigator.serviceWorker.controller;
    });
    const title = document.getElementById('title-screen');
    if (title) new MutationObserver(reloadAtTitle).observe(title, {attributes: true, attributeFilter: ['hidden']});
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', {updateViaCache: 'none'});
      let lastCheck = Date.now();
      const checkForUpdate = () => {
        if (document.visibilityState === 'hidden' || Date.now() - lastCheck < 60000) return;
        lastCheck = Date.now(); registration.update().catch(() => {});
      };
      window.addEventListener('focus', checkForUpdate);
      document.addEventListener('visibilitychange', checkForUpdate);
      const installing = registration.installing || registration.waiting;
      if (installing && installing.state !== 'activated') await new Promise((resolve, reject) => {
        installing.addEventListener('statechange', () => {
          if (installing.state === 'activated') resolve();
          if (installing.state === 'redundant') reject(new Error('Offline installation did not complete.'));
        });
      });
      await navigator.serviceWorker.ready;
      if (notice && !notice.textContent && !updatePending) notice.textContent = 'Ready for offline play.';
    } catch {
      // The browser game remains playable if installation or storage is unavailable.
    }
  }, {once: true});
})();
