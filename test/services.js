'use strict'

/* eslint-env mocha */

const assert = require('assert')
const read = require('fs').readFileSync
const YAML = require('js-yaml')
const path = require('path')
const punycode = require('punycode/')
const URL = require('url').URL
const uu = require('../')()
const parallel = require('mocha.parallel')

const urls = YAML.load(read(path.join(__dirname, 'services.yml'), 'utf8'))
const domains = YAML.load(read(path.join(__dirname, '..', 'domains.yml'), 'utf8'))

const checkAll = (process.env.LINKS_CHECK === 'all')

// get 2nd level domain, e.g. "foo.example.org" -> "example.org"
function truncateDomain (str) {
  return str.split('.').slice(-2).join('.')
}

describe('Services', function () {
  it('all services should be tested', function () {
    let expected = []
    const actual = []

    domains.forEach(function (d) {
      if (typeof d === 'string') {
        expected.push(d)
      } else {
        expected = expected.concat(Object.keys(d))
      }
    })

    Object.keys(urls).forEach(function (url) {
      const u = new URL(url)

      actual.push(u.host)
    })

    assert.deepStrictEqual(
      expected.map(truncateDomain).map(punycode.toUnicode).sort(),
      actual.map(truncateDomain).map(punycode.toUnicode).sort()
    )
  })

  parallel('ping services', function () {
    let links = Object.keys(urls)

    if (!checkAll) { links = links.slice(0, 1) }

    links.forEach(function (link) {
      it(link, async () => {
        const result = await uu.expand(link)
        assert.strictEqual(result, urls[link])
      })
    })
  })
})
