// Process vk.com/away.php redirects
//

'use strict'

const URL = require('url')

exports.validate = function (url) {
  const urlObj = URL.parse(url, true, true)

  return urlObj.pathname === '/away.php' && urlObj.query && urlObj.query.to
}

exports.fetch = function (url) {
  const urlObj = URL.parse(url, true, true)

  return Promise.resolve(urlObj.query.to)
}
