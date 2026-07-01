// Help channel chooser: lets the user pick Claudia (Salesforce/Agentforce) or the Fin Agent
// (Intercom Messenger). Loaded after app.js so it can reuse the global openHelpDrawer().

(function () {
  const FIN_APP_ID = 'vhj4lo02';

  const overlay = document.getElementById('helpChooserOverlay');
  const closeBtn = document.getElementById('helpChooserClose');
  const claudiaBtn = document.getElementById('chooseClaudia');
  const finBtn = document.getElementById('chooseFin');

  function openChooser() {
    if (!overlay) return;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function closeChooser() {
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function launchFinMessenger() {
    window.intercomSettings = { api_base: 'https://api-iam.intercom.io', app_id: FIN_APP_ID };
    if (typeof window.Intercom !== 'function') {
      const stub = function () { stub.c(arguments); };
      stub.q = [];
      stub.c = function (args) { stub.q.push(args); };
      window.Intercom = stub;
    }
    const existing = document.getElementById('intercom-widget-script');
    if (!existing) {
      const s = document.createElement('script');
      s.id = 'intercom-widget-script';
      s.async = true;
      s.src = 'https://widget.intercom.io/widget/' + FIN_APP_ID;
      s.onload = function () {
        // Boot anonymously (no identified user) to avoid identity-verification issues.
        window.Intercom('boot', { app_id: FIN_APP_ID });
        window.Intercom('show');
      };
      document.body.appendChild(s);
    } else {
      window.Intercom('boot', { app_id: FIN_APP_ID });
      window.Intercom('show');
    }
  }

  // Re-bind the "Get Help" button so it opens the chooser instead of Claudia directly.
  // Cloning the node drops app.js's existing click listener without editing app.js.
  const originalGetHelp = document.getElementById('profileGetHelpBtn');
  if (originalGetHelp) {
    const getHelpBtn = originalGetHelp.cloneNode(true);
    originalGetHelp.parentNode.replaceChild(getHelpBtn, originalGetHelp);
    getHelpBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (typeof window.closeProfileMenu === 'function') {
        window.closeProfileMenu();
      } else {
        const menu = document.getElementById('profileMenu');
        if (menu) menu.classList.remove('open');
      }
      openChooser();
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', closeChooser);
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeChooser();
    });
  }
  if (claudiaBtn) {
    claudiaBtn.addEventListener('click', async function () {
      closeChooser();
      if (typeof window.openHelpDrawer === 'function') {
        await window.openHelpDrawer();
      }
    });
  }
  if (finBtn) {
    finBtn.addEventListener('click', function () {
      closeChooser();
      launchFinMessenger();
    });
  }
})();
