'use strict'

/* eslint-env mocha */

const assert = require('assert')
const nock = require('nock')
const { isErrorFatal } = require('../')

describe('Default', function () {
  let uu

  before(async () => {
    uu = require('..')({
      request: {
        retry: 0
      }
    })
    uu.add('example.org')
  })

  it('should process redirect', async () => {
    nock('http://example.org')
      .get('/foo')
      .reply(301, '', { location: 'https://github.com/0' })

    const result = await uu.expand('http://example.org/foo')
    assert.strictEqual(result, 'https://github.com/0')
  })

  it('should parse meta tags', async () => {
    const html = '<html><head><meta http-equiv="refresh" content="10; url=https://github.com/1 "></head><body></body></html>'
    nock('http://example.org')
      .get('/bar')
      .reply(200, html, { 'content-type': 'text/html' })

    const result = await uu.expand('http://example.org/bar')
    assert.strictEqual(result, 'https://github.com/1')
  })

  it("should not process file if it's not html", async () => {
    const html = '<html><head><meta http-equiv="refresh" content="10; url=https://github.com/1 "></head><body></body></html>'
    nock('http://example.org')
      .get('/zzz')
      .reply(200, html, { 'content-type': 'application/json' })

    const result = await uu.expand('http://example.org/zzz')
    assert.strictEqual(result, null)
  })

  it('should return nothing on 404', async () => {
    nock('http://example.org')
      .get('/baz')
      .reply(404, '')

    const result = await uu.expand('http://example.org/baz')
    assert.strictEqual(result, null)
  })

  it('should return errors on unknown status codes', async () => {
    nock('http://example.org')
      .get('/bazzz')
      .reply(503, '')

    await assert.rejects(
      async () => uu.expand('http://example.org/bazzz'),
      err => {
        assert.match(err.message, /Remote server error/)
        assert.strictEqual(err.code, 'EHTTP')
        assert.strictEqual(err.statusCode, 503)
        assert.strictEqual(isErrorFatal(err), false)
        return true
      }
    )
  })

  it('should treat invalid urls as fatal error', async () => {
    nock('http://example.org')
      .get('/invalid')
      .reply(301, '', { location: 'http://xn--/1' })

    await assert.rejects(
      async () => uu.expand('http://example.org/invalid'),
      err => {
        assert.match(err.message, /Redirected to an invalid location/)
        assert.strictEqual(err.code, 'EBADREDIRECT')
        assert.strictEqual(isErrorFatal(err), true)
        return true
      }
    )
  })

  it.skip('should fail on page > 100K', async () => {
    const html = ' '.repeat(110000) + '<html><head><meta http-equiv="refresh" content="10; url=https://github.com/1 "></head><body></body></html>'
    nock('http://example.org')
      .get('/large')
      .reply(200, html, { 'content-type': 'text/html' })

    const result = await uu.expand('http://example.org/large')
    assert.strictEqual(result, null)
  })
})
