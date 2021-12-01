// Process vk.com/away.php redirects
//

'use strict'

const URL = require('url').URL

exports.validate = url => {
  const u = new URL(url)

  return u.pathname === '/away.php' && u.searchParams.get('to')
}

exports.fetch = async url => {
  const u = new URL(url)

  return u.searchParams.get('to')
}
