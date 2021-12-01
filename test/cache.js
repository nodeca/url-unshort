'use strict'

/* eslint-env mocha */

const assert = require('assert')

describe('Cache', function () {
  let uu
  let fetchCount = 0
  let cache = {}
  let result

  before(() => {
    uu = require('../')({
      cache: {
        get: async key => cache[key],
        set: async (key, value) => {
          cache[key] = value
          return true
        }
      }
    })

    uu.add('example.org', {
      async fetch () {
        fetchCount++
        return 'http://foo.bar/'
      }
    })
  })

  it('should cache urls', async () => {
    cache = {}

    result = await uu.expand('http://example.org/foo')
    assert.strictEqual(result, 'http://foo.bar/')

    result = await uu.expand('http://example.org/foo')
    assert.strictEqual(result, 'http://foo.bar/')
    assert.strictEqual(fetchCount, 1)
  })

  it('should not cache invalid urls', async () => {
    cache = {}

    result = await uu.expand('http://invalid-url.com/foo')
    assert.strictEqual(result, null)
    assert.deepStrictEqual(cache, {})
  })

  it('should resolve disabled services from cache, if used before', async () => {
    cache = { 'http://old.service.com/123': 'http://redirected.to/' }

    result = await uu.expand('http://old.service.com/123')
    assert.strictEqual(result, 'http://redirected.to/')
  })

  it('should forward hash to cached value', async () => {
    cache = { 'http://old.service.com/123': 'http://redirected.to/' }

    result = await uu.expand('http://old.service.com/123#foo')
    assert.strictEqual(result, 'http://redirected.to/#foo')
  })

  it('should cache null result after first fetch', async () => {
    uu.add('example2.org', {
      fetch: async () => null
    })

    cache = {}

    result = await uu.expand('http://example2.org/foo')
    assert.strictEqual(result, null)
    assert.deepStrictEqual(cache, { 'http://example2.org/foo': null })

    result = await uu.expand('http://example2.org/foo')
    assert.strictEqual(result, null)
  })

  it('should properly cache last null fetch in nested redirects', async () => {
    uu.add('example3.org', {
      fetch: async () => 'http://example4.org/test'
    })

    uu.add('example4.org', {
      fetch: async () => null
    })

    cache = {}

    result = await uu.expand('http://example3.org/foo')
    assert.strictEqual(result, 'http://example4.org/test')
    assert.deepStrictEqual(cache, { 'http://example3.org/foo': 'http://example4.org/test' })
  })
})
