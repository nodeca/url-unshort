// Process vk.com/away.php redirects
//

'use strict'

const URL = require('url').URL

exports.validate = function (url) {
  const u = new URL(url)

  return u.pathname === '/away.php' && u.searchParams.get('to')
}

exports.fetch = function (url) {
  const u = new URL(url)

  return Promise.resolve(u.searchParams.get('to'))
}
