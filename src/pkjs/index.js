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
      console.log('Geolocation unavailable: ' + err.message + ' — watch uses defaults');
    },
    { timeout: 15000, maximumAge: 300000 }
  );
}

Pebble.addEventListener('ready', function() {
  fetchSunAndWeather();
});

Pebble.addEventListener('showConfiguration', function() {
  var url = 'data:text/html,' + encodeURIComponent(
    '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width">' +
    '<style>body{font-family:-apple-system,sans-serif;margin:20px;background:#f5f5f5;color:#111}' +
    'h2{color:#111}' +
    '.card{background:#fff;border-radius:8px;padding:16px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.12)}' +
    '.row{display:flex;justify-content:space-between;align-items:center}' +
    'label{font-size:16px;color:#111}' +
    'input[type=checkbox]{width:22px;height:22px}' +
    'button{width:100%;padding:14px;background:#007aff;color:#fff;border:none;border-radius:8px;font-size:16px;margin-top:16px}' +
    '</style></head><body>' +
    '<h2>slow-24h Settings</h2>' +
    '<div class="card"><div class="row"><label>12-hour numerals</label>' +
    '<input type="checkbox" id="use12h"></div></div>' +
    '<div class="card"><div class="row"><label>Show rain overlay</label>' +
    '<input type="checkbox" id="showRain" checked></div></div>' +
    '<button onclick="submit()">Save</button>' +
    '<script>' +
    'var opts=JSON.parse(decodeURIComponent(location.hash.substring(1))||"{}");' +
    'if(opts.use12h)document.getElementById("use12h").checked=true;' +
    'if(opts.showRain===false)document.getElementById("showRain").checked=false;' +
    'function submit(){var r={use12h:document.getElementById("use12h").checked,' +
    'showRain:document.getElementById("showRain").checked};' +
    'document.location="pebblejs://close#"+encodeURIComponent(JSON.stringify(r))}' +
    '</script></body></html>'
  );
  var hash = encodeURIComponent(JSON.stringify({
    use12h: localStorage.getItem('use12h') === 'true',
    showRain: localStorage.getItem('showRain') !== 'false'
  }));
  Pebble.openURL(url + '#' + hash);
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
