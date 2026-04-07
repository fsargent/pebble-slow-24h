var xhrRequest = function(url, type, callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function() { callback(this.responseText); };
  xhr.open(type, url);
  xhr.send();
};

function packTides(heights, offset) {
  var packed = 0;
  for (var i = 0; i < 8; i++) {
    packed |= ((heights[offset + i] & 0xF) << (i * 4));
  }
  return packed | 0; // coerce to signed int32 for AppMessage
}

function fetchSunAndTides() {
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      var lat = pos.coords.latitude;
      var lon = pos.coords.longitude;

      var sunUrl = 'https://api.open-meteo.com/v1/forecast' +
        '?latitude=' + lat +
        '&longitude=' + lon +
        '&daily=sunrise,sunset' +
        '&timezone=auto' +
        '&forecast_days=1';

      var marineUrl = 'https://marine-api.open-meteo.com/v1/marine' +
        '?latitude=' + lat +
        '&longitude=' + lon +
        '&hourly=wave_height' +
        '&timezone=auto' +
        '&forecast_days=1';

      var sunDone = false, marineDone = false;
      var srMin, ssMin, tideValues;

      function trySend() {
        if (!sunDone || !marineDone) return;
        Pebble.sendAppMessage(
          {
            'KEY_SUNRISE': srMin,
            'KEY_SUNSET': ssMin,
            'KEY_TIDE_0': packTides(tideValues, 0),
            'KEY_TIDE_1': packTides(tideValues, 8),
            'KEY_TIDE_2': packTides(tideValues, 16)
          },
          function() { console.log('Tide data sent: rise=' + srMin + ' set=' + ssMin); },
          function(e) { console.log('Failed to send tide data: ' + JSON.stringify(e)); }
        );
      }

      xhrRequest(sunUrl, 'GET', function(responseText) {
        var data = JSON.parse(responseText);
        var sunrise = data.daily.sunrise[0];
        var sunset  = data.daily.sunset[0];
        var srParts = sunrise.split('T')[1].split(':');
        var ssParts = sunset.split('T')[1].split(':');
        srMin = parseInt(srParts[0], 10) * 60 + parseInt(srParts[1], 10);
        ssMin = parseInt(ssParts[0], 10) * 60 + parseInt(ssParts[1], 10);
        sunDone = true;
        trySend();
      });

      xhrRequest(marineUrl, 'GET', function(responseText) {
        var data = JSON.parse(responseText);
        var raw = data.hourly.wave_height;
        tideValues = [];

        // Normalize to 0-15 using the day's range
        var maxH = 0;
        for (var i = 0; i < 24 && i < raw.length; i++) {
          var v = raw[i] || 0;
          if (v > maxH) maxH = v;
        }
        for (var i = 0; i < 24; i++) {
          if (i < raw.length && maxH > 0) {
            tideValues.push(Math.min(15, Math.round((raw[i] || 0) * 15 / maxH)));
          } else {
            tideValues.push(0);
          }
        }
        console.log('Tide heights (0-15): ' + tideValues.join(','));
        marineDone = true;
        trySend();
      });
    },
    function(err) {
      console.log('Geolocation unavailable: ' + err.message);
    },
    { timeout: 15000, maximumAge: 300000 }
  );
}

Pebble.addEventListener('ready', function() {
  fetchSunAndTides();
});

// __CONFIG_HTML__ is replaced at build time by inline-config.sh from config.html
var CONFIG_HTML = '__CONFIG_HTML__';

Pebble.addEventListener('showConfiguration', function() {
  var hash = encodeURIComponent(JSON.stringify({
    use12h: localStorage.getItem('use12h') === 'true',
    showTides: localStorage.getItem('showTides') !== 'false'
  }));
  Pebble.openURL('data:text/html,' + CONFIG_HTML + '#' + hash);
});

Pebble.addEventListener('webviewclosed', function(e) {
  if (!e || !e.response) return;
  var cfg = JSON.parse(decodeURIComponent(e.response));
  localStorage.setItem('use12h', cfg.use12h);
  localStorage.setItem('showTides', cfg.showTides);
  Pebble.sendAppMessage(
    { 'KEY_USE_12H': cfg.use12h ? 1 : 0, 'KEY_SHOW_TIDES': cfg.showTides ? 1 : 0 },
    function() { console.log('Settings saved: 12h=' + cfg.use12h + ' tides=' + cfg.showTides); },
    function(err) { console.log('Failed to send settings: ' + JSON.stringify(err)); }
  );
});
