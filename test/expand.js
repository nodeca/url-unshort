'use strict'

/* eslint-env mocha */

const assert = require('assert')

const urls = {
  'http://example.org/regular': 'https://github.com/',

  // loop1 -> loop2 -> loop3 -> loop4 -> github
  'http://example.org/loop1': 'http://example.org/loop2',
  'http://example.org/loop2': 'http://example.org/loop3',
  'http://example.org/loop3': 'http://example.org/loop4',
  'http://example.org/loop4': 'https://github.com/',

  // self-referenced
  'http://example.org/cycle': 'http://example.org/cycle',

  // control characters in the output
  'http://example.org/control': 'https://github.com/<foo\rbar baz>',

  // invalid protocol
  'http://example.org/file': 'file:///etc/passwd',

  // result has anchor in it
  'http://example.org/hashy': 'https://github.com/foo#bar',

  // relative urls
  'http://example.org/rel1': '//github.com/foo',
  'http://example.org/rel2': '/foo',

  // l1 -> l2 -> null
  'http://example.org/l1': 'http://example.org/l2',
  'http://example.org/l2': null
}

describe('Expand', function () {
  let uu
  let result

  before(function () {
    uu = require('../')()

    uu.add('example.org', {
      fetch: url => urls[url.replace(/^https/, 'http')]
    })
  })

  it('should expand regular url via Promise', async () => {
    result = await uu.expand('http://example.org/regular')
    assert.strictEqual(result, 'https://github.com/')
  })

  it('should expand url up to 3 levels', async () => {
    result = await uu.expand('http://example.org/loop2')
    assert.strictEqual(result, 'https://github.com/')
  })

  it('should fail on url nested more than 3 levels', async () => {
    await assert.rejects(
      async () => uu.expand('http://example.org/loop1'),
      /Too many redirects/
    )
  })

  it('should fail on links redirecting to themselves', async () => {
    await assert.rejects(
      async () => uu.expand('http://example.org/cycle'),
      /Too many redirects/
    )
  })

  it('should fail on bad protocols', async () => {
    await assert.rejects(
      async () => uu.expand('http://example.org/file'),
      /Redirected to an invalid location/
    )
  })

  it('should not encode non-url characters', async () => {
    result = await uu.expand('http://example.org/control')
    assert.strictEqual(result, 'https://github.com/<foo\rbar baz>')
  })

  it('should preserve an anchor', async () => {
    result = await uu.expand('http://example.org/regular#foobar')
    assert.strictEqual(result, 'https://github.com/#foobar')
  })

  it('should respect destination anchor', async () => {
    result = await uu.expand('http://example.org/hashy#quux')
    assert.strictEqual(result, 'https://github.com/foo#bar')
  })

  it('should accept relative urls without protocol', async () => {
    result = await uu.expand('//example.org/regular')
    assert.strictEqual(result, 'https://github.com/')
  })

  it('should accept links to relative urls without protocol', async () => {
    result = await uu.expand('http://example.org/rel1')
    assert.strictEqual(result, '//github.com/foo')
  })

  it('should reject links to relative urls without host', async () => {
    await assert.rejects(
      async () => uu.expand('http://example.org/rel2'),
      /Redirected to an invalid location/
    )
  })

  it('should properly expand url with last null fetch in nested redirects', async () => {
    result = await uu.expand('http://example.org/l1')
    assert.strictEqual(result, 'http://example.org/l2')
  })
})
