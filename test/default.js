'use strict'

/* eslint-env mocha */

const assert = require('assert')

describe('Default', function () {
  let uu
  let result

  before(() => {
    uu = require('../')()
    uu.add('example.org')
  })

  it('should process redirect', async () => {
    uu.request = async () => ({
      statusCode: 301,
      headers: { location: 'https://github.com/0' },
      body: ''
    })

    result = await uu.expand('http://example.org/foo')
    assert.strictEqual(result, 'https://github.com/0')
  })

  it('should parse meta tags', async () => {
    uu.request = async () => ({
      statusCode: 200,
      headers: { 'content-type': 'text/html' },
      body: '<html><head><meta http-equiv="refresh" content="10; url=https://github.com/1 "></head><body></body></html>'
    })

    result = await uu.expand('http://example.org/bar')
    assert.strictEqual(result, 'https://github.com/1')
  })

  it('should not process file if it\'s not html', async () => {
    uu.request = async () => ({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: '<html><head><meta http-equiv="refresh" content="10; url=https://github.com/1 "></head><body></body></html>'
    })

    result = await uu.expand('http://example.org/zzz')
    assert.strictEqual(result, null)
  })

  it('should return nothing on 404', async () => {
    /* eslint-disable no-throw-literal */
    uu.request = () => { throw { statusCode: 404 } }

    result = await uu.expand('http://example.org/baz')
    assert.strictEqual(result, null)
  })

  it('should return errors on unknown status codes', async () => {
    /* eslint-disable no-throw-literal */
    uu.request = () => { throw { statusCode: 503 } }

    await assert.rejects(
      async () => uu.expand('http://example.org/baz'),
      /Remote server error/
    )
  })

  it.skip('should fail on page > 100K', function () {
  })
})
