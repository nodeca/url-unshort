// Error class based on http://stackoverflow.com/questions/8458984
//
'use strict'

class UnshortError extends Error {
  constructor (message, code, statusCode) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)

    if (code) this.code = code
    if (statusCode) this.statusCode = statusCode
  }
}

module.exports = UnshortError
