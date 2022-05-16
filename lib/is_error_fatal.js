// Function checks whether an error can be retried later or not
//
'use strict'

function isErrorFatal (err) {
  // HTTP errors, fatal errors are everything except:
  // - 5xx - server-side errors
  // - 429 - rate limit
  // - 408 - request timeout
  if (err.statusCode && !String(+err.statusCode).match(/^(5..|429|408)$/)) {
    return true
  }

  // EINVAL - bad urls like http://1234
  if (err.code === 'EINVAL') return true

  // server returned invalid url or caused redirect loop
  if (err.code === 'EBADREDIRECT') return true

  return false
}

module.exports = isErrorFatal
