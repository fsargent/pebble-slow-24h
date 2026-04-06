var xhrRequest = function(url, type, callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function() { callback(this.responseText); };
  xhr.open(type, url);
  xhr.send();
};

function fetchSunAndWeather() {
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      var url = 'https://api.open-meteo.com/v1/forecast' +
        '?latitude=' + pos.coords.latitude +
        '&longitude=' + pos.coords.longitude +
        '&daily=sunrise,sunset' +
        '&hourly=precipitation_probability' +
        '&timezone=auto' +
        '&forecast_days=1';

      xhrRequest(url, 'GET', function(responseText) {
        var data = JSON.parse(responseText);
        var sunrise = data.daily.sunrise[0];
        var sunset  = data.daily.sunset[0];

        var srParts = sunrise.split('T')[1].split(':');
        var ssParts = sunset.split('T')[1].split(':');
        var srMin = parseInt(srParts[0], 10) * 60 + parseInt(srParts[1], 10);
        var ssMin = parseInt(ssParts[0], 10) * 60 + parseInt(ssParts[1], 10);

        var rainBitmask = 0;
        var probs = data.hourly.precipitation_probability;
        for (var h = 0; h < 24 && h < probs.length; h++) {
          if (probs[h] > 50) {
            rainBitmask |= (1 << h);
          }
        }

        Pebble.sendAppMessage(
          { 'KEY_SUNRISE': srMin, 'KEY_SUNSET': ssMin, 'KEY_RAIN_HOURS': rainBitmask },
          function() { console.log('Weather sent: rise=' + srMin + ' set=' + ssMin + ' rain=0x' + rainBitmask.toString(16)); },
          function(e) { console.log('Failed to send weather: ' + JSON.stringify(e)); }
        );
      });
    },
    function(err) {
      console.log('Geolocation unavailable: ' + err.message);
    },
    { timeout: 15000, maximumAge: 300000 }
  );
}

Pebble.addEventListener('ready', function() {
  fetchSunAndWeather();
});

// __CONFIG_HTML__ is replaced at build time by inline-config.sh from config.html
var CONFIG_HTML = '__CONFIG_HTML__';

Pebble.addEventListener('showConfiguration', function() {
  var hash = encodeURIComponent(JSON.stringify({
    use12h: localStorage.getItem('use12h') === 'true',
    showRain: localStorage.getItem('showRain') !== 'false'
  }));
  Pebble.openURL('data:text/html,' + CONFIG_HTML + '#' + hash);
});

Pebble.addEventListener('webviewclosed', function(e) {
  if (!e || !e.response) return;
  var cfg = JSON.parse(decodeURIComponent(e.response));
  localStorage.setItem('use12h', cfg.use12h);
  localStorage.setItem('showRain', cfg.showRain);
  Pebble.sendAppMessage(
    { 'KEY_USE_12H': cfg.use12h ? 1 : 0, 'KEY_SHOW_RAIN': cfg.showRain ? 1 : 0 },
    function() { console.log('Settings saved: 12h=' + cfg.use12h + ' rain=' + cfg.showRain); },
    function(err) { console.log('Failed to send settings: ' + JSON.stringify(err)); }
  );
});
