// Process flic.kr redirects (including relative urls default fetcher can't do)
//

'use strict'

const mdurl = require('mdurl')
const UnshortError = require('../error')

exports.fetch = async function (url) {
  let nestingLeft = 5

  while (nestingLeft--) {
    let res

    try {
      res = await this.request(url, { method: 'HEAD' })
    } catch (e) {
      if (e.statusCode >= 400 && e.statusCode < 500) return null

      throw new UnshortError(
        `Remote server error, code ${e.code}, statusCode ${e.statusCode}`,
        'EHTTP',
        e.statusCode)
    }

    if (this._isRedirect(res.statusCode)) {
      const uSrc = mdurl.parse(url, true)
      const uDst = mdurl.parse(res.headers.location, true)

      if (!uDst.hostname) { uDst.hostname = uSrc.hostname }
      if (!uDst.protocol) { uDst.protocol = uSrc.protocol }
      if (!uDst.slashes) { uDst.slashes = uSrc.slashes }

      url = mdurl.format(uDst)
      continue
    }

    // reached destination
    if (res.statusCode >= 200 && res.statusCode < 300) return url

    throw new UnshortError(`Unexpected status code: ${res.statusCode}`, 'EHTTP', res.statusCode)
  }

  return null
}
