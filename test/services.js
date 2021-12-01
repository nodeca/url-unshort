'use strict'

/* eslint-env mocha */

const assert = require('assert')
const fs = require('fs')
const YAML = require('js-yaml')
const path = require('path')
const punycode = require('punycode/')
const URL = require('url').URL
const urls = YAML.load(fs.readFileSync(path.join(__dirname, 'services.yml'), 'utf8'))
const domains = YAML.load(fs.readFileSync(path.join(__dirname, '..', 'domains.yml'), 'utf8'))
const uu = require('../')()
const parallel = require('mocha.parallel')

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

    assert.deepEqual(expected.map(truncateDomain).map(punycode.toUnicode).sort(),
      actual.map(truncateDomain).map(punycode.toUnicode).sort())
  })

  parallel('ping services', function () {
    let links = Object.keys(urls)

    if (!checkAll) { links = links.slice(0, 1) }

    links.forEach(function (link) {
      it(link, function () {
        return uu.expand(link).then(function (result) {
          assert.strictEqual(result, urls[link])
        })
      })
    })
  })
})
