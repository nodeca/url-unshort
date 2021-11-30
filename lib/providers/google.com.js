// Process google.com/url?... redirects
//

'use strict'

const URL = require('url')
const isGoogle = require('is-google-domain')

exports.validate = function (url) {
  const urlObj = URL.parse(url, true, true)

  if (!isGoogle(urlObj.hostname)) return false

  return urlObj.pathname === '/url' && urlObj.query && urlObj.query.url
}

exports.fetch = function (url) {
  const urlObj = URL.parse(url, true, true)

  return Promise.resolve(urlObj.query.url)
}
