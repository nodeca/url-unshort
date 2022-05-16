'use strict'

/* eslint-env mocha */

const assert = require('assert')
const http = require('http')
const { isErrorFatal } = require('../')

describe('Default', function () {
  let uu
  let server
  let host
  let callback

  before(async () => {
    server = http.createServer((req, res) => {
      callback(req, res)
    })

    await new Promise(resolve => {
      server.listen(resolve)
    })

    host = `localhost:${server.address().port}`

    uu = require('..')({
      request: {
        retry: {
          calculateDelay: () => {
            return 0 // no delay between retries
          }
        }
      }
    })
    uu.add(host)
  })

  it('should process redirect', async () => {
    callback = (_, res) => {
      res.statusCode = 301
      res.setHeader('location', 'https://github.com/0')
      res.end()
    }

    const result = await uu.expand(`http://${host}/foo`)
    assert.strictEqual(result, 'https://github.com/0')
  })

  it('should parse meta tags', async () => {
    callback = (_, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'text/html')
      res.end('<html><head><meta http-equiv="refresh" content="10; url=https://github.com/1 "></head><body></body></html>')
    }

    const result = await uu.expand(`http://${host}/bar`)
    assert.strictEqual(result, 'https://github.com/1')
  })

  it("should not process file if it's not html", async () => {
    callback = (_, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end('<html><head><meta http-equiv="refresh" content="10; url=https://github.com/1 "></head><body></body></html>')
    }

    const result = await uu.expand(`http://${host}/zzz`)
    assert.strictEqual(result, null)
  })

  it('should return nothing on 404', async () => {
    callback = (_, res) => {
      res.statusCode = 404
      res.end()
    }

    const result = await uu.expand(`http://${host}/baz`)
    assert.strictEqual(result, null)
  })

  it('should return errors on unknown status codes', async () => {
    callback = (_, res) => {
      res.statusCode = 503
      res.end()
    }

    await assert.rejects(
      async () => uu.expand(`http://${host}/baz`),
      err => {
        assert.match(err.message, /Remote server error/)
        assert.strictEqual(err.code, 'EHTTP')
        assert.strictEqual(isErrorFatal(err), false)
        return true
      }
    )
  })

  it('should treat invalid urls as fatal error', async () => {
    callback = (_, res) => {
      res.statusCode = 301
      res.setHeader('location', 'http://xn--/1')
      res.end()
    }

    await assert.rejects(
      async () => uu.expand(`http://${host}/invalid`),
      err => {
        assert.match(err.message, /Redirected to an invalid location/)
        assert.strictEqual(err.code, 'EBADREDIRECT')
        assert.strictEqual(isErrorFatal(err), true)
        return true
      }
    )
  })

  it.skip('should fail on page > 100K', async () => {
  })

  after(() => {
    server.close()
  })
})
