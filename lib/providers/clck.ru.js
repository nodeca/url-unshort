// clck.ru redirects to https://sba.yandex.net/redirect?url=..., which
// restricts allowed user agents.
// Let's extract url directly.

'use strict'

const URL = require('url').URL
const UnshortError = require('../error')

exports.fetch = async function (url) {
  let res
  try {
    res = await this.request(url, { method: 'HEAD' })
  } catch (e) {
    if (e.statusCode >= 400 && e.statusCode < 500) return null
    throw e
  }

  if (!this._isRedirect(res.statusCode)) {
    throw new UnshortError(
      `Unexpected server response ${res.statusCode}, expect redirect`,
      'EHTTP',
      500
    )
  }

  let dest
  try {
    const u = new URL(res.headers.location)
    dest = u.searchParams.get('url')
  } catch (e) {
    throw new UnshortError(
      'Redirected to an invalid location',
      'EBADREDIRECT'
    )
  }

  return dest
}
