// Process vk.com/away.php redirects
//


'use strict';


var URL = require('url');


module.exports = function (url, options, callback) {
  var urlObj = URL.parse(url, true, true);

  if (!urlObj.query || !urlObj.query.to) {
    callback();
    return;
  }

  callback(null, urlObj.query.to);
};
