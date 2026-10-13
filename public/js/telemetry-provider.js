/**
 * Open MCT Telemetry Provider Plugin for Lunar Gateway Mission
 * 
 * Maps REST history and WebSocket real-time streams into Open MCT Domain Objects.
 */

function LunarGatewayTelemetryPlugin() {
  return function install(openmct) {
    // 1. Root folder for Gateway Mission
    openmct.objects.addRoot({
      namespace: 'gateway.taxonomy',
      key: 'root'
    });

    let dictionary = null;
    const subscribers = {};
    let socket = null;
    let reconnectTimer = null;

    function connectTelemetrySocket() {
      const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = wsProtocol + '//' + location.host + '/telemetry';
      
      socket = new WebSocket(wsUrl);

      socket.onopen = function () {
        console.log('[Telemetry WS] Connected to live mission telemetry feed.');
        // Resubscribe all active listeners
        Object.keys(subscribers).forEach(function (pointId) {
          if (subscribers[pointId].length > 0) {
            socket.send(JSON.stringify({ type: 'subscribe', id: pointId }));
          }
        });
      };

      socket.onmessage = function (event) {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'telemetry_batch' && message.data) {
            Object.keys(message.data).forEach(function (pointId) {
              const raw = message.data[pointId];
              const datum = {
                id: pointId,
                utc: raw.timestamp,
                timestamp: raw.timestamp,
                value: raw.value
              };

              if (subscribers[pointId]) {
                subscribers[pointId].forEach(function (cb) {
                  cb(datum);
                });
              }
            });

            // Dispatch event for VR HUD and 3D space scene
            window.dispatchEvent(new CustomEvent('vr-telemetry-update', {
              detail: {
                data: message.data,
                fleet: message.fleet,
                primarySatellite: message.primarySatellite,
                timestamp: message.timestamp
              }
            }));
          }
        } catch (e) {
          console.error('[Telemetry WS] Parse error:', e);
        }
      };

      socket.onclose = function () {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connectTelemetrySocket, 3000);
      };

      socket.onerror = function () {
        socket.close();
      };
    }

    connectTelemetrySocket();

    // Load mission dictionary from server
    const dictionaryPromise = fetch('/api/dictionary')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        dictionary = data;
        return data;
      });

    // 2. Object Provider
    openmct.objects.addProvider('gateway.taxonomy', {
      get: function (identifier) {
        return dictionaryPromise.then(function (dict) {
          if (identifier.key === 'root') {
            return {
              identifier: identifier,
              name: '🛰️ Real-Time Spacecraft Fleet (Earth & Moon)',
              type: 'folder',
              location: 'ROOT'
            };
          }

          // Master Fleet Table
          if (identifier.key === 'fleet.table') {
            const allPoints = [];
            dict.subsystems.forEach(function (sub) {
              sub.points.forEach(function (pt) { allPoints.push(pt); });
            });
            return {
              identifier: identifier,
              name: '📊 Master Fleet Live Telemetry Table',
              type: 'table',
              composition: allPoints.map(function (pt) {
                return { namespace: 'gateway.taxonomy', key: pt };
              }),
              location: 'gateway.taxonomy:root'
            };
          }

          // Subsystem folders
          const sub = dict.subsystems.find(function (s) { return s.id === identifier.key; });
          if (sub) {
            return {
              identifier: identifier,
              name: sub.name,
              type: 'folder',
              location: 'gateway.taxonomy:root'
            };
          }

          // Dedicated Satellite Live Telemetry Table
          if (identifier.key.endsWith('.table')) {
            const subId = identifier.key.replace('.table', '');
            const parentSub = dict.subsystems.find(function (s) { return s.id === subId; });
            if (parentSub) {
              return {
                identifier: identifier,
                name: '📋 ' + parentSub.name + ' - Live Data Table',
                type: 'table',
                composition: parentSub.points.map(function (pt) {
                  return { namespace: 'gateway.taxonomy', key: pt };
                }),
                location: 'gateway.taxonomy:' + subId
              };
            }
          }

          // Dedicated Satellite Telemetry Overlay Plot
          if (identifier.key.endsWith('.plot')) {
            const subId = identifier.key.replace('.plot', '');
            const parentSub = dict.subsystems.find(function (s) { return s.id === subId; });
            if (parentSub) {
              return {
                identifier: identifier,
                name: '📈 ' + parentSub.name + ' - Flight Charts',
                type: 'telemetry.plot.overlay',
                composition: parentSub.points.filter(function (p) {
                  return p.includes('altitude') || p.includes('velocity');
                }).map(function (pt) {
                  return { namespace: 'gateway.taxonomy', key: pt };
                }),
                location: 'gateway.taxonomy:' + subId
              };
            }
          }

          // Telemetry Points
          const pointMeta = dict.points[identifier.key];
          if (pointMeta) {
            const parentSub = dict.subsystems.find(function (s) {
              return s.points.indexOf(identifier.key) !== -1;
            });

            return {
              identifier: identifier,
              name: pointMeta.name,
              type: 'gateway.telemetry',
              telemetry: {
                values: [
                  {
                    key: 'value',
                    name: 'Value',
                    unit: pointMeta.units,
                    format: pointMeta.isDiscrete ? 'string' : 'number',
                    min: pointMeta.min,
                    max: pointMeta.max,
                    hints: {
                      range: 1
                    }
                  },
                  {
                    key: 'utc',
                    source: 'timestamp',
                    name: 'Time',
                    format: 'utc',
                    hints: {
                      domain: 1
                    }
                  }
                ]
              },
              location: parentSub ? ('gateway.taxonomy:' + parentSub.id) : 'gateway.taxonomy:root'
            };
          }

          return null;
        });
      }
    });

    // 3. Composition Provider (Folder children)
    openmct.composition.addProvider({
      appliesTo: function (domainObject) {
        return domainObject.identifier.namespace === 'gateway.taxonomy' &&
          (domainObject.type === 'folder' || domainObject.type === 'table' || domainObject.type === 'telemetry.plot.overlay' || domainObject.identifier.key === 'root');
      },
      load: function (domainObject) {
        return dictionaryPromise.then(function (dict) {
          if (domainObject.identifier.key === 'root') {
            const items = [{ namespace: 'gateway.taxonomy', key: 'fleet.table' }];
            dict.subsystems.forEach(function (sub) {
              items.push({ namespace: 'gateway.taxonomy', key: sub.id });
            });
            return items;
          }

          // If domain object has predefined composition, return it
          if (domainObject.composition && domainObject.composition.length > 0) {
            return domainObject.composition;
          }

          const sub = dict.subsystems.find(function (s) { return s.id === domainObject.identifier.key; });
          if (sub) {
            const items = [
              { namespace: 'gateway.taxonomy', key: sub.id + '.table' },
              { namespace: 'gateway.taxonomy', key: sub.id + '.plot' }
            ];
            sub.points.forEach(function (pt) {
              items.push({ namespace: 'gateway.taxonomy', key: pt });
            });
            return items;
          }

          return [];
        });
      }
    });

    // 4. Custom Telemetry Type Definition
    openmct.types.addType('gateway.telemetry', {
      name: 'Gateway Telemetry Point',
      description: 'Real-time telemetry stream from Lunar Gateway space vehicle',
      cssClass: 'icon-telemetry'
    });

    // 5. Telemetry Provider (Request History + Real-time Subscription)
    openmct.telemetry.addProvider({
      supportsRequest: function (domainObject) {
        return domainObject.type === 'gateway.telemetry';
      },
      supportsSubscribe: function (domainObject) {
        return domainObject.type === 'gateway.telemetry';
      },
      request: function (domainObject, options) {
        options = options || {};
        const start = options.start !== undefined ? options.start : (Date.now() - 900000);
        const end = options.end !== undefined ? options.end : Date.now();
        const pointId = domainObject.identifier.key;

        return fetch('/api/history/' + encodeURIComponent(pointId) + '?start=' + start + '&end=' + end)
          .then(function (res) { return res.json(); })
          .then(function (data) {
            return data.map(function (point) {
              return {
                id: point.id,
                utc: point.timestamp,
                timestamp: point.timestamp,
                value: point.value
              };
            });
          });
      },
      subscribe: function (domainObject, callback) {
        const pointId = domainObject.identifier.key;
        if (!subscribers[pointId]) {
          subscribers[pointId] = [];
        }
        subscribers[pointId].push(callback);

        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'subscribe', id: pointId }));
        }

        // Return unsubscribe function
        return function unsubscribe() {
          if (subscribers[pointId]) {
            subscribers[pointId] = subscribers[pointId].filter(function (cb) {
              return cb !== callback;
            });
          }
        };
      }
    });
  };
}
