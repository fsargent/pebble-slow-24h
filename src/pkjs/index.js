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

// %3C%21DOCTYPE%20html%3E%0A%3Chtml%3E%0A%3Chead%3E%0A%20%20%3Cmeta%20name%3D%22viewport%22%20content%3D%22width%3Ddevice-width%22%3E%0A%20%20%3Cstyle%3E%0A%20%20%20%20body%20%7B%20font-family%3A%20-apple-system%2C%20sans-serif%3B%20margin%3A%2020px%3B%20background%3A%20%23f5f5f5%3B%20color%3A%20%23111%20%7D%0A%20%20%20%20h2%20%7B%20color%3A%20%23111%20%7D%0A%20%20%20%20.card%20%7B%20background%3A%20%23fff%3B%20border-radius%3A%208px%3B%20padding%3A%2016px%3B%20margin-bottom%3A%2012px%3B%20box-shadow%3A%200%201px%203px%20rgba%280%2C0%2C0%2C.12%29%20%7D%0A%20%20%20%20.row%20%7B%20display%3A%20flex%3B%20justify-content%3A%20space-between%3B%20align-items%3A%20center%20%7D%0A%20%20%20%20label%20%7B%20font-size%3A%2016px%3B%20color%3A%20%23111%20%7D%0A%20%20%20%20input%5Btype%3D%22checkbox%22%5D%20%7B%20width%3A%2022px%3B%20height%3A%2022px%20%7D%0A%20%20%20%20button%20%7B%20width%3A%20100%25%3B%20padding%3A%2014px%3B%20background%3A%20%23007aff%3B%20color%3A%20%23fff%3B%20border%3A%20none%3B%20border-radius%3A%208px%3B%20font-size%3A%2016px%3B%20margin-top%3A%2016px%3B%20cursor%3A%20pointer%20%7D%0A%20%20%20%20%23result%20%7B%20margin-top%3A%2016px%3B%20padding%3A%2012px%3B%20background%3A%20%23e8f5e9%3B%20border-radius%3A%208px%3B%20display%3A%20none%3B%20font-family%3A%20monospace%3B%20font-size%3A%2014px%3B%20color%3A%20%23111%20%7D%0A%20%20%3C%2Fstyle%3E%0A%3C%2Fhead%3E%0A%3Cbody%3E%0A%20%20%3Ch2%3Eslow-24h%20Settings%3C%2Fh2%3E%0A%20%20%3Cdiv%20class%3D%22card%22%3E%3Cdiv%20class%3D%22row%22%3E%0A%20%20%20%20%3Clabel%3E12-hour%20numerals%3C%2Flabel%3E%0A%20%20%20%20%3Cinput%20type%3D%22checkbox%22%20id%3D%22use12h%22%3E%0A%20%20%3C%2Fdiv%3E%3C%2Fdiv%3E%0A%20%20%3Cdiv%20class%3D%22card%22%3E%3Cdiv%20class%3D%22row%22%3E%0A%20%20%20%20%3Clabel%3EShow%20rain%20overlay%3C%2Flabel%3E%0A%20%20%20%20%3Cinput%20type%3D%22checkbox%22%20id%3D%22showRain%22%20checked%3E%0A%20%20%3C%2Fdiv%3E%3C%2Fdiv%3E%0A%20%20%3Cbutton%20onclick%3D%22submit%28%29%22%3ESave%3C%2Fbutton%3E%0A%20%20%3Cdiv%20id%3D%22result%22%3E%3C%2Fdiv%3E%0A%20%20%3Cscript%3E%0A%20%20%20%20var%20opts%20%3D%20%7B%7D%3B%0A%20%20%20%20try%20%7B%20opts%20%3D%20JSON.parse%28decodeURIComponent%28location.hash.substring%281%29%29%29%3B%20%7D%20catch%28e%29%20%7B%7D%0A%20%20%20%20if%20%28opts.use12h%29%20document.getElementById%28%27use12h%27%29.checked%20%3D%20true%3B%0A%20%20%20%20if%20%28opts.showRain%20%3D%3D%3D%20false%29%20document.getElementById%28%27showRain%27%29.checked%20%3D%20false%3B%0A%0A%20%20%20%20function%20submit%28%29%20%7B%0A%20%20%20%20%20%20var%20r%20%3D%20%7B%0A%20%20%20%20%20%20%20%20use12h%3A%20document.getElementById%28%27use12h%27%29.checked%2C%0A%20%20%20%20%20%20%20%20showRain%3A%20document.getElementById%28%27showRain%27%29.checked%0A%20%20%20%20%20%20%7D%3B%0A%20%20%20%20%20%20if%20%28window.location.protocol%20%3D%3D%3D%20%27data%3A%27%29%20%7B%0A%20%20%20%20%20%20%20%20document.location%20%3D%20%27pebblejs%3A%2F%2Fclose%23%27%20%2B%20encodeURIComponent%28JSON.stringify%28r%29%29%3B%0A%20%20%20%20%20%20%7D%20else%20%7B%0A%20%20%20%20%20%20%20%20var%20el%20%3D%20document.getElementById%28%27result%27%29%3B%0A%20%20%20%20%20%20%20%20el.style.display%20%3D%20%27block%27%3B%0A%20%20%20%20%20%20%20%20el.textContent%20%3D%20%27Would%20send%3A%20%27%20%2B%20JSON.stringify%28r%2C%20null%2C%202%29%3B%0A%20%20%20%20%20%20%7D%0A%20%20%20%20%7D%0A%20%20%3C%2Fscript%3E%0A%3C%2Fbody%3E%0A%3C%2Fhtml%3E%0A is replaced at build time by inline-config.sh from config.html
var CONFIG_HTML = '%3C%21DOCTYPE%20html%3E%0A%3Chtml%3E%0A%3Chead%3E%0A%20%20%3Cmeta%20name%3D%22viewport%22%20content%3D%22width%3Ddevice-width%22%3E%0A%20%20%3Cstyle%3E%0A%20%20%20%20body%20%7B%20font-family%3A%20-apple-system%2C%20sans-serif%3B%20margin%3A%2020px%3B%20background%3A%20%23f5f5f5%3B%20color%3A%20%23111%20%7D%0A%20%20%20%20h2%20%7B%20color%3A%20%23111%20%7D%0A%20%20%20%20.card%20%7B%20background%3A%20%23fff%3B%20border-radius%3A%208px%3B%20padding%3A%2016px%3B%20margin-bottom%3A%2012px%3B%20box-shadow%3A%200%201px%203px%20rgba%280%2C0%2C0%2C.12%29%20%7D%0A%20%20%20%20.row%20%7B%20display%3A%20flex%3B%20justify-content%3A%20space-between%3B%20align-items%3A%20center%20%7D%0A%20%20%20%20label%20%7B%20font-size%3A%2016px%3B%20color%3A%20%23111%20%7D%0A%20%20%20%20input%5Btype%3D%22checkbox%22%5D%20%7B%20width%3A%2022px%3B%20height%3A%2022px%20%7D%0A%20%20%20%20button%20%7B%20width%3A%20100%25%3B%20padding%3A%2014px%3B%20background%3A%20%23007aff%3B%20color%3A%20%23fff%3B%20border%3A%20none%3B%20border-radius%3A%208px%3B%20font-size%3A%2016px%3B%20margin-top%3A%2016px%3B%20cursor%3A%20pointer%20%7D%0A%20%20%20%20%23result%20%7B%20margin-top%3A%2016px%3B%20padding%3A%2012px%3B%20background%3A%20%23e8f5e9%3B%20border-radius%3A%208px%3B%20display%3A%20none%3B%20font-family%3A%20monospace%3B%20font-size%3A%2014px%3B%20color%3A%20%23111%20%7D%0A%20%20%3C%2Fstyle%3E%0A%3C%2Fhead%3E%0A%3Cbody%3E%0A%20%20%3Ch2%3Eslow-24h%20Settings%3C%2Fh2%3E%0A%20%20%3Cdiv%20class%3D%22card%22%3E%3Cdiv%20class%3D%22row%22%3E%0A%20%20%20%20%3Clabel%3E12-hour%20numerals%3C%2Flabel%3E%0A%20%20%20%20%3Cinput%20type%3D%22checkbox%22%20id%3D%22use12h%22%3E%0A%20%20%3C%2Fdiv%3E%3C%2Fdiv%3E%0A%20%20%3Cdiv%20class%3D%22card%22%3E%3Cdiv%20class%3D%22row%22%3E%0A%20%20%20%20%3Clabel%3EShow%20rain%20overlay%3C%2Flabel%3E%0A%20%20%20%20%3Cinput%20type%3D%22checkbox%22%20id%3D%22showRain%22%20checked%3E%0A%20%20%3C%2Fdiv%3E%3C%2Fdiv%3E%0A%20%20%3Cbutton%20onclick%3D%22submit%28%29%22%3ESave%3C%2Fbutton%3E%0A%20%20%3Cdiv%20id%3D%22result%22%3E%3C%2Fdiv%3E%0A%20%20%3Cscript%3E%0A%20%20%20%20var%20opts%20%3D%20%7B%7D%3B%0A%20%20%20%20try%20%7B%20opts%20%3D%20JSON.parse%28decodeURIComponent%28location.hash.substring%281%29%29%29%3B%20%7D%20catch%28e%29%20%7B%7D%0A%20%20%20%20if%20%28opts.use12h%29%20document.getElementById%28%27use12h%27%29.checked%20%3D%20true%3B%0A%20%20%20%20if%20%28opts.showRain%20%3D%3D%3D%20false%29%20document.getElementById%28%27showRain%27%29.checked%20%3D%20false%3B%0A%0A%20%20%20%20function%20submit%28%29%20%7B%0A%20%20%20%20%20%20var%20r%20%3D%20%7B%0A%20%20%20%20%20%20%20%20use12h%3A%20document.getElementById%28%27use12h%27%29.checked%2C%0A%20%20%20%20%20%20%20%20showRain%3A%20document.getElementById%28%27showRain%27%29.checked%0A%20%20%20%20%20%20%7D%3B%0A%20%20%20%20%20%20if%20%28window.location.protocol%20%3D%3D%3D%20%27data%3A%27%29%20%7B%0A%20%20%20%20%20%20%20%20document.location%20%3D%20%27pebblejs%3A%2F%2Fclose%23%27%20%2B%20encodeURIComponent%28JSON.stringify%28r%29%29%3B%0A%20%20%20%20%20%20%7D%20else%20%7B%0A%20%20%20%20%20%20%20%20var%20el%20%3D%20document.getElementById%28%27result%27%29%3B%0A%20%20%20%20%20%20%20%20el.style.display%20%3D%20%27block%27%3B%0A%20%20%20%20%20%20%20%20el.textContent%20%3D%20%27Would%20send%3A%20%27%20%2B%20JSON.stringify%28r%2C%20null%2C%202%29%3B%0A%20%20%20%20%20%20%7D%0A%20%20%20%20%7D%0A%20%20%3C%2Fscript%3E%0A%3C%2Fbody%3E%0A%3C%2Fhtml%3E%0A';

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
