/**
 * VR HUD Overlay Controller (Real ISS Flight Operations)
 * 
 * Provides laser-pointer-friendly quick buttons and floating telemetry dials
 * displaying live satellite flight telemetry for the International Space Station.
 */

(function () {
  window.addEventListener('DOMContentLoaded', function () {
    // Top Bar VR Buttons
    const btnFocusIss = document.getElementById('btn-focus-iss');
    const btnFocusEarth = document.getElementById('btn-focus-earth');
    const btnFocusSun = document.getElementById('btn-focus-sun');
    const btnCrewInfo = document.getElementById('btn-crew-info');
    const btnToggleVrMode = document.getElementById('btn-toggle-vr');

    if (btnFocusIss) {
      btnFocusIss.addEventListener('click', function () {
        if (window.OpenSpaceBridge) {
          window.OpenSpaceBridge.setTargetAnchor('ISS');
        }
      });
    }

    if (btnFocusEarth) {
      btnFocusEarth.addEventListener('click', function () {
        if (window.OpenSpaceBridge) {
          window.OpenSpaceBridge.setTargetAnchor('Earth');
        }
      });
    }

    if (btnFocusSun) {
      btnFocusSun.addEventListener('click', function () {
        if (window.OpenSpaceBridge) {
          window.OpenSpaceBridge.setTargetAnchor('Sun');
        }
      });
    }

    if (btnCrewInfo) {
      btnCrewInfo.addEventListener('click', function () {
        alert(
          "Current Expedition Crew on ISS:\n" +
          "• Oleg Kononenko (Commander)\n" +
          "• Nikolai Chub\n" +
          "• Tracy Caldwell Dyson\n" +
          "• Matthew Dominick\n" +
          "• Michael Barratt\n" +
          "• Jeanette Epps\n" +
          "• Alexander Grebenkin\n" +
          "• Butch Wilmore\n" +
          "• Sunita Williams\n\n" +
          "Source: NASA / Open Notify Live Manifest"
        );
      });
    }

    if (btnToggleVrMode) {
      btnToggleVrMode.addEventListener('click', function () {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(function () {});
          btnToggleVrMode.innerText = '🥽 EXIT VR FULLSCREEN';
        } else {
          document.exitFullscreen().catch(function () {});
          btnToggleVrMode.innerText = '🥽 VR FULLSCREEN';
        }
      });
    }

    // Telemetry Quick Strip elements
    const elAlt = document.getElementById('dial-alt');
    const elVel = document.getElementById('dial-vel');
    const elLat = document.getElementById('dial-lat');
    const elLon = document.getElementById('dial-lon');
    const elSolar = document.getElementById('dial-solar');

    window.addEventListener('vr-telemetry-update', function (e) {
      const data = e.detail;
      if (!data) return;

      if (elAlt && data['iss.orbit.altitude']) {
        elAlt.innerText = data['iss.orbit.altitude'].value + ' km';
      }
      if (elVel && data['iss.orbit.velocity_kms']) {
        elVel.innerText = data['iss.orbit.velocity_kms'].value + ' km/s';
      }
      if (elLat && data['iss.orbit.latitude']) {
        const lat = data['iss.orbit.latitude'].value;
        elLat.innerText = (lat >= 0 ? lat + '° N' : Math.abs(lat) + '° S');
      }
      if (elLon && data['iss.orbit.longitude']) {
        const lon = data['iss.orbit.longitude'].value;
        elLon.innerText = (lon >= 0 ? lon + '° E' : Math.abs(lon) + '° W');
      }
      if (elSolar && data['iss.solar.visibility']) {
        const state = (data['iss.solar.visibility'].value || 'daylight').toUpperCase();
        elSolar.innerText = state;
        elSolar.style.color = (state === 'DAYLIGHT') ? 'var(--vr-amber)' : 'var(--vr-cyan)';
      }
    });
  });
})();
