/**
 * Open MCT Main Application Bootstrap
 * Configured according to Open MCT v4 standards with Lunar Gateway Mission & OpenSpace Bridge.
 */

(function () {
  const openmct = window.openmct;

  const THIRTY_MINUTES = 30 * 60 * 1000;
  const THIRTY_SECONDS = 30 * 1000;
  const ONE_HOUR = 60 * 60 * 1000;

  // 1. Assets Path
  openmct.setAssetPath('/openmct-dist');

  // 2. Core Open MCT Plugins
  openmct.install(openmct.plugins.LocalStorage());
  openmct.install(openmct.plugins.MyItems());
  openmct.install(openmct.plugins.UTCTimeSystem());

  // Visual Themes (Espresso dark theme looks stunning in VR)
  if (openmct.plugins.Espresso) {
    openmct.install(openmct.plugins.Espresso());
  }

  // Time Conductor for real-time and historical replay
  openmct.install(
    openmct.plugins.Conductor({
      menuOptions: [
        {
          name: 'Realtime (Live Flight)',
          timeSystem: 'utc',
          clock: 'local',
          clockOffsets: {
            start: -THIRTY_MINUTES,
            end: THIRTY_SECONDS
          },
          presets: [
            {
              label: '1 Hour',
              bounds: {
                start: -ONE_HOUR,
                end: THIRTY_SECONDS
              }
            },
            {
              label: '30 Minutes',
              bounds: {
                start: -THIRTY_MINUTES,
                end: THIRTY_SECONDS
              }
            }
          ]
        },
        {
          name: 'Fixed History (Replay)',
          timeSystem: 'utc',
          bounds: {
            start: () => Date.now() - THIRTY_MINUTES,
            end: () => Date.now()
          }
        }
      ]
    })
  );

  // Layouts & Visualizers
  openmct.install(openmct.plugins.PlanLayout({ creatable: true }));
  openmct.install(openmct.plugins.Timeline());
  openmct.install(openmct.plugins.Hyperlink());
  openmct.install(openmct.plugins.AutoflowView({ type: 'telemetry.panel' }));
  openmct.install(openmct.plugins.DisplayLayout({ showAsView: ['summary-widget'] }));
  openmct.install(openmct.plugins.SummaryWidget());
  openmct.install(openmct.plugins.Notebook());
  openmct.install(openmct.plugins.LADTable());
  openmct.install(openmct.plugins.Clock({ enableClockIndicator: true }));
  openmct.install(openmct.plugins.Timer());
  openmct.install(openmct.plugins.Timelist());
  openmct.install(openmct.plugins.BarChart());
  openmct.install(openmct.plugins.ScatterPlot());

  // 3. Install Custom Mission Plugins
  openmct.install(LunarGatewayTelemetryPlugin());
  openmct.install(OpenSpaceSyncPlugin({
    port: 4682
  }));

  // 4. Start Open MCT
  document.addEventListener('DOMContentLoaded', function () {
    openmct.start();
  });
})();
