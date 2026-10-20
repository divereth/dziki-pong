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
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Update an open title screen, while leaving an active run uninterrupted.
      if (hadController && !document.getElementById('title-screen')?.hidden) location.reload();
    }, {once: true});
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', {updateViaCache: 'none'});
      const installing = registration.installing || registration.waiting;
      if (installing && installing.state !== 'activated') await new Promise((resolve, reject) => {
        installing.addEventListener('statechange', () => {
          if (installing.state === 'activated') resolve();
          if (installing.state === 'redundant') reject(new Error('Offline installation did not complete.'));
        });
      });
      await navigator.serviceWorker.ready;
      if (notice && !notice.textContent) notice.textContent = 'Ready for offline play.';
    } catch {
      // The browser game remains playable if installation or storage is unavailable.
    }
  }, {once: true});
})();
