// Process vk.com/away.php redirects
//


'use strict';


var URL = require('url');


exports.validate = function (url) {
  var urlObj = URL.parse(url, true, true);

  return urlObj.pathname === '/away.php' && urlObj.query && urlObj.query.to;
};


exports.fetch = function (url, options, callback) {
  var urlObj = URL.parse(url, true, true);

  callback(null, urlObj.query.to);
};
