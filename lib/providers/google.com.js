// Process google.com/url?... redirects
//

'use strict'

const URL = require('url').URL
const isGoogle = require('is-google-domain')

exports.validate = function (url) {
  const u = new URL(url)

  if (!isGoogle(u.hostname)) return false

  return u.pathname === '/url' && u.searchParams.get('url')
}

exports.fetch = function (url) {
  const u = new URL(url)

  return Promise.resolve(u.searchParams.get('url'))
}
