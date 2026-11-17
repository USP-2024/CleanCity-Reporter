/* ---------------------------------------------------------------------------
   Entry point. The Flutter app calls:
     CleanSim.start('cleaner', {...})        worker simulator
     CleanSim.start('control_room', {...})   admin CCTV control room
     CleanSim.update({...})                  refresh control-room data
     CleanSim.uploadResult(ok, message)      result of the photo upload
   Messages back to Flutter go through CS.send(...)  ->  Flutter.postMessage(...)
   Test it in a normal browser:  index.html?mode=cleaner   or   index.html?mode=control_room
--------------------------------------------------------------------------- */
(function () {
  'use strict';
  window.__errors = [];
  const reported = {};
  let reportedCount = 0;
  window.addEventListener('error', function (e) {
    const m = String(e.message);
    window.__errors.push(m);
    // report each different problem once (max 3), so a repeating error cannot flood the app
    if (reported[m] || reportedCount >= 3) return;
    reported[m] = true;
    reportedCount++;
    CS.send({ type: 'jsError', message: m });
  });

  let started = false;
  window.CleanSim = {
    start: function (mode, data) {
      if (started) return;
      started = true;
      const loading = document.getElementById('loading');
      try {
        if (mode === 'cleaner') {
          document.getElementById('hud-cleaner').classList.remove('hidden');
          Cleaner.start(data || {});
        } else {
          document.getElementById('hud-control').classList.remove('hidden');
          ControlRoom.start(data || {});
        }
        if (loading) loading.remove();
        CS.send({ type: 'ready', mode: mode });
      } catch (err) {
        const msg = 'The 3D view could not start: ' + err.message;
        document.body.insertAdjacentHTML('beforeend', '<div id="fatal">' + msg + '</div>');
        CS.send({ type: 'jsError', message: msg });
      }
    },
    update: function (data) {
      if (window.ControlRoom && ControlRoom.update) ControlRoom.update(data || {});
    },
    uploadResult: function (ok, msg) {
      if (window.Cleaner && Cleaner.uploadResult) Cleaner.uploadResult(ok, msg);
    },
  };

  // Browser testing: open index.html?mode=cleaner (or control_room)
  const params = new URLSearchParams(location.search);
  if (params.get('mode')) {
    window.CleanSim.start(params.get('mode'), window.__demoData ? window.__demoData() : {});
  }
})();
