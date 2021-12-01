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

  before(function () {
    uu = require('../')()

    uu.add('example.org', {
      fetch (url) {
        return Promise.resolve(urls[url.replace(/^https/, 'http')])
      }
    })
  })

  it('should expand regular url via Promise', function () {
    return uu.expand('http://example.org/regular').then(result => {
      assert.equal(result, 'https://github.com/')
    })
  })

  it('should expand url up to 3 levels', function () {
    return uu.expand('http://example.org/loop2')
      .then(result => assert.equal(result, 'https://github.com/'))
  })

  it('should fail on url nested more than 3 levels', function () {
    return uu.expand('http://example.org/loop1')
      .then(() => { throw new Error('error should be thrown here') })
      .catch(err => assert.equal(err.message, 'Too many redirects'))
  })

  it('should fail on links redirecting to themselves', function () {
    return uu.expand('http://example.org/cycle')
      .then(() => { throw new Error('error should be thrown here') })
      .catch(err => assert.equal(err.message, 'Too many redirects'))
  })

  it('should fail on bad protocols', function () {
    return uu.expand('http://example.org/file')
      .then(() => { throw new Error('error should be thrown here') })
      .catch(err => assert.equal(err.message, 'Redirected to an invalid location'))
  })

  it('should not encode non-url characters', function () {
    return uu.expand('http://example.org/control')
      .then(result => assert.equal(result, 'https://github.com/<foo\rbar baz>'))
  })

  it('should preserve an anchor', function () {
    return uu.expand('http://example.org/regular#foobar')
      .then(result => assert.equal(result, 'https://github.com/#foobar'))
  })

  it('should respect destination anchor', function () {
    return uu.expand('http://example.org/hashy#quux')
      .then(result => assert.equal(result, 'https://github.com/foo#bar'))
  })

  it('should accept relative urls without protocol', function () {
    return uu.expand('//example.org/regular')
      .then(result => assert.equal(result, 'https://github.com/'))
  })

  it('should accept links to relative urls without protocol', function () {
    return uu.expand('http://example.org/rel1')
      .then(result => assert.equal(result, '//github.com/foo'))
  })

  it('should reject links to relative urls without host', function () {
    return uu.expand('http://example.org/rel2')
      .then(() => { throw new Error('error should be thrown here') })
      .catch(err => assert.equal(err.message, 'Redirected to an invalid location'))
  })

  it('should properly expand url with last null fetch in nested redirects', function () {
    return uu.expand('http://example.org/l1')
      .then(result => assert.equal(result, 'http://example.org/l2'))
  })
})
