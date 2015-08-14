// Process flic.kr redirects (including relative urls default fetcher can't do)
//


'use strict';


var mdurl = require('mdurl');


function isRedirect(code) {
  return code === 301
      || code === 302
      || code === 303
      || code === 307
      || code === 308;
}


function fetchFlickr(url, nestingLeft, callback) {
  var self = this;

  if (nestingLeft <= 0) {
    callback();
    return;
  }

  self.request({
    method: 'HEAD',
    url: url
  }, function (err, res, body) {
    if (err) {
      callback(err);
      return;
    }

    if (isRedirect(res.statusCode)) {
      var uSrc = mdurl.parse(url, true);
      var uDst = mdurl.parse(res.headers.location, true);

      if (!uDst.hostname) { uDst.hostname = uSrc.hostname; }
      if (!uDst.protocol) { uDst.protocol = uSrc.protocol; }
      if (!uDst.slashes)  { uDst.slashes  = uSrc.slashes; }

      fetchFlickr.call(self, mdurl.format(uDst), nestingLeft - 1, callback);
      return;
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      // reached destination
      callback(null, url);
      return;
    }

    if (res.statusCode >= 400 && res.statusCode < 500) {
      callback();
      return;
    }

    callback(new Error('Unexpected status code: ' + res.statusCode));
  });
}


module.exports = function (url, options, callback) {
  fetchFlickr.call(this, url, 5, callback);
};
