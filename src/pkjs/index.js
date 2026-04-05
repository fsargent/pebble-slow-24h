var xhrRequest = function(url, type, callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function() { callback(this.responseText); };
  xhr.open(type, url);
  xhr.send();
};

function fetchSunTimes() {
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      var url = 'https://api.open-meteo.com/v1/forecast' +
        '?latitude=' + pos.coords.latitude +
        '&longitude=' + pos.coords.longitude +
        '&daily=sunrise,sunset' +
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

        Pebble.sendAppMessage(
          { 'KEY_SUNRISE': srMin, 'KEY_SUNSET': ssMin },
          function() { console.log('Sun times sent: rise=' + srMin + ' set=' + ssMin); },
          function(e) { console.log('Failed to send sun times: ' + JSON.stringify(e)); }
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
  fetchSunTimes();
});
