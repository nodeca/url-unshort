// Process flic.kr redirects (including relative urls default fetcher can't do)
//

'use strict'

const URL = require('url').URL
const UnshortError = require('../error')

exports.fetch = async function (url) {
  let nestingLeft = 5

  while (nestingLeft--) {
    let res

    try {
      res = await this.request(url, { method: 'HEAD' })
    } catch (e) {
      if (e.statusCode >= 400 && e.statusCode < 500) return null
      throw e
    }

    if (this._isRedirect(res.statusCode)) {
      try {
        const uDst = new URL(res.headers.location, url)

        url = uDst.toString()
        continue
      } catch (e) {
        if (e instanceof TypeError && e.message === 'Invalid URL') {
          throw new UnshortError('Redirected to an invalid location', 'EBADREDIRECT')
        }

        throw e
      }
    }

    // reached destination
    if (res.statusCode >= 200 && res.statusCode < 300) return url

    throw new UnshortError(`Unexpected status code: ${res.statusCode}`, 'EHTTP', res.statusCode)
  }

  return null
}
