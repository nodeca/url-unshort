'use strict'

/* eslint-env mocha */

const assert = require('assert')

describe('Default', function () {
  let uu

  before(function () {
    uu = require('../')()

    uu.add('example.org')
  })

  it('should process redirect', function () {
    uu.request = () => Promise.resolve({
      statusCode: 301,
      headers: { location: 'https://github.com/0' },
      body: ''
    })

    return uu.expand('http://example.org/foo')
      .then(result => assert.strictEqual(result, 'https://github.com/0'))
  })

  it('should parse meta tags', function () {
    uu.request = () => Promise.resolve({
      statusCode: 200,
      headers: { 'content-type': 'text/html' },
      body: '<html><head><meta http-equiv="refresh" content="10; url=https://github.com/1 "></head><body></body></html>'
    })

    return uu.expand('http://example.org/bar')
      .then(result => assert.strictEqual(result, 'https://github.com/1'))
  })

  it('should not process file if it\'s not html', function () {
    uu.request = () => Promise.resolve({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: '<html><head><meta http-equiv="refresh" content="10; url=https://github.com/1 "></head><body></body></html>'
    })

    return uu.expand('http://example.org/zzz')
      .then(result => assert.strictEqual(result, null))
  })

  it('should return nothing on 404', function () {
    /* eslint-disable prefer-promise-reject-errors */
    uu.request = () => Promise.reject({
      statusCode: 404
    })

    return uu.expand('http://example.org/baz')
      .then(result => assert.strictEqual(result, null))
  })

  it('should return errors on unknown status codes', function () {
    /* eslint-disable prefer-promise-reject-errors */
    uu.request = () => Promise.reject({
      statusCode: 503
    })

    return uu.expand('http://example.org/baz')
      .then(() => { throw new Error('error should be thrown here') })
      .catch(err => assert(err.message.match(/Remote server error/)))
  })

  it.skip('should fail on page > 100K', function () {
  })
})
