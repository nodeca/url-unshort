// Process google.com/url?... redirects
//


'use strict';


var URL = require('url');
var isGoogle = require('is-google-domain');


exports.validate = function (url) {
  var urlObj = URL.parse(url, true, true);

  if (!isGoogle(urlObj.hostname)) return false;

  return urlObj.pathname === '/url' && urlObj.query && urlObj.query.url;
};


exports.fetch = function (url, options, callback) {
  var urlObj = URL.parse(url, true, true);

  callback(null, urlObj.query.url);
};
