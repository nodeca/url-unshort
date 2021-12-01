// Process google.com/url?... redirects
//

'use strict'

const URL = require('url').URL
const isGoogle = require('is-google-domain')

exports.validate = url => {
  const u = new URL(url)

  if (!isGoogle(u.hostname)) return false

  return u.pathname === '/url' && u.searchParams.get('url')
}

exports.fetch = async url => {
  const u = new URL(url)

  return u.searchParams.get('url')
}
