(function () {
  var GPX_URL = '/gpx/RTTR-10k-course.gpx';
  var METERS_TO_FEET = 3.28084;

  function haversineMiles(lat1, lon1, lat2, lon2) {
    var R = 3958.8;
    var toRad = function (d) { return d * Math.PI / 180; };
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function showError(statsEl) {
    if (statsEl) {
      statsEl.textContent = 'Interactive map is temporarily unavailable — see the printable map above.';
    }
  }

  function initCourseMap() {
    var mapEl = document.getElementById('course-map');
    var statsEl = document.getElementById('course-stats');
    var chartEl = document.getElementById('elevation-chart');
    if (!mapEl || typeof L === 'undefined') return;

    fetch(GPX_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('GPX fetch failed: ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var xml = new DOMParser().parseFromString(text, 'application/xml');
        if (xml.getElementsByTagName('parsererror').length) {
          throw new Error('GPX parse error');
        }
        var trkpts = xml.getElementsByTagName('trkpt');
        var latlngs = [];
        var distancesMi = [];
        var elevationsFt = [];
        var totalMiles = 0;
        var elevGainFt = 0;
        var elevLossFt = 0;

        for (var i = 0; i < trkpts.length; i++) {
          var pt = trkpts[i];
          var lat = parseFloat(pt.getAttribute('lat'));
          var lon = parseFloat(pt.getAttribute('lon'));
          var eleEl = pt.getElementsByTagName('ele')[0];
          var eleFt = (eleEl ? parseFloat(eleEl.textContent) : 0) * METERS_TO_FEET;

          if (i > 0) {
            var prevLatLng = latlngs[i - 1];
            totalMiles += haversineMiles(prevLatLng[0], prevLatLng[1], lat, lon);
            var diff = eleFt - elevationsFt[i - 1];
            if (diff > 0) { elevGainFt += diff; } else { elevLossFt += -diff; }
          }

          latlngs.push([lat, lon]);
          distancesMi.push(totalMiles);
          elevationsFt.push(eleFt);
        }

        if (!latlngs.length) throw new Error('No track points in GPX');

        var map = L.map('course-map');
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        var route = L.polyline(latlngs, { color: '#FC4C02', weight: 4 }).addTo(map);
        map.fitBounds(route.getBounds(), { padding: [20, 20] });

        L.circleMarker(latlngs[0], { radius: 8, color: '#1a7a1a', fillColor: '#2ecc40', fillOpacity: 1, weight: 2 })
          .addTo(map)
          .bindPopup('Start');

        L.circleMarker(latlngs[latlngs.length - 1], { radius: 8, color: '#8c1414', fillColor: '#e0142c', fillOpacity: 1, weight: 2 })
          .addTo(map)
          .bindPopup('Finish');

        if (statsEl) {
          statsEl.textContent = 'Distance: ' + totalMiles.toFixed(2) + ' mi — Elevation gain: ' +
            Math.round(elevGainFt) + ' ft — Elevation loss: ' + Math.round(elevLossFt) + ' ft';
        }

        if (chartEl && typeof Chart !== 'undefined') {
          var sampleEvery = Math.max(1, Math.floor(distancesMi.length / 300));
          var labels = [];
          var data = [];
          for (var j = 0; j < distancesMi.length; j += sampleEvery) {
            labels.push(distancesMi[j].toFixed(2));
            data.push(Math.round(elevationsFt[j]));
          }
          new Chart(chartEl.getContext('2d'), {
            type: 'line',
            data: {
              labels: labels,
              datasets: [{
                label: 'Elevation (ft)',
                data: data,
                borderColor: '#FC4C02',
                backgroundColor: 'rgba(252, 76, 2, 0.15)',
                fill: true,
                pointRadius: 0,
                borderWidth: 2,
                tension: 0.2
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: { title: { display: true, text: 'Distance (mi)' } },
                y: { title: { display: true, text: 'Elevation (ft)' } }
              },
              plugins: { legend: { display: false } }
            }
          });
        }
      })
      .catch(function (err) {
        showError(statsEl);
        if (window.console && console.error) console.error('Could not load course GPX:', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCourseMap);
  } else {
    initCourseMap();
  }
})();
