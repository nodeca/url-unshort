// Main class
//

'use strict'

const $ = require('cheerio')
const read = require('fs').readFileSync
const yaml = require('js-yaml')
const mdurl = require('mdurl')
const path = require('path')
const punycode = require('punycode/')
const got = require('got')
const escapeRe = require('escape-string-regexp')
const merge = require('lodash.merge')
const UnshortError = require('./error')
const pkg = require('../package.json')

const config = yaml.load(read(path.join(__dirname, '..', 'domains.yml'), 'utf8'))

const defaultAgent = `${pkg.name}/${pkg.version} (+https://github.com/nodeca/url-unshort)`

const defaultOptions = {
  timeout: 30 * 1000,
  retries: 1,
  followRedirect: false, // redirects are handled manually
  maxBuffer: 1000 * 1024, // too big reply -> not redirect
  headers: {
    'User-Agent': defaultAgent
  }
}

const customProviders = require('./providers/index')

// Create an unshortener instance
//
// options:
//  - cache   (Object) - cache instance
//    - get(key) -> Promise
//    - set(key, value)  -> Promise
//  - nesting (Number) - max amount of redirects to follow, default: `3`
//  - request (Object) - default options for `got` in `.request()` method
//
function Unshort (options = {}) {
  if (!(this instanceof Unshort)) return new Unshort(options)

  this._options = merge({}, defaultOptions, options.request || {})

  // config data with compiled regexps and fetch functions attached
  this._domains = []

  this.cache = options.cache || {
    get: async () => {},
    set: async () => {}
  }

  this.nesting = options.nesting || 3

  // Regexp that matches links to all the known services, it is used
  // to determine whether url should be processed at all or not.
  //
  // Initialized to regexp that matches nothing, it gets overwritten
  // when domains are added.
  //
  this._matchAllRE = /(?!)/

  const domainMap = {}

  config.forEach(domain => {
    if (typeof domain === 'string') {
      domainMap[domain] = {}
      return
    }

    Object.keys(domain).forEach(d => {
      domainMap[d] = Object.assign({}, domain[d])
    })
  })

  Object.keys(domainMap).forEach(domain => {
    if (customProviders[domain]) {
      domainMap[domain].fetch = customProviders[domain].fetch
      domainMap[domain].validate = customProviders[domain].validate
    }

    this.add(domain, domainMap[domain])
  })
}

// Add a domain name to the list of known domains
//
//  - domains (String|Array) - list of domain names
//  - options (Object)       - options for these domains
//    - select  (String)        - jquery-like selector to retrieve url with
//    - match   (String|RegExp) - custom regexp to use to match this domain
//    - fetch   (Function)      - custom function to retrieve expanded url
//
Unshort.prototype.add = function (domain, options) {
  if (Array.isArray(domain)) {
    domain.forEach(d => this.add(d, options))
    return
  }

  const domainConfig = Object.assign({}, options)

  if (!domainConfig.fetch) domainConfig.fetch = this._defaultFetch

  if (!domainConfig.validate) domainConfig.validate = () => true

  // Prepare list of all the domain names, including aliases
  // and punycode variations
  //
  // e.g. for `➡.ws` this array will contain both encodings of this domain:
  // `[ '➡.ws', 'xn--hgi.ws' ]`
  let dList = [domain].concat(domainConfig.aliases || [])

  // create variations + make unique
  dList = Array.from(new Set(dList.map(punycode.toASCII).concat(dList.map(punycode.toUnicode))))

  if (domainConfig.match) {
    // regexp is specified by a user
    domainConfig._compiledMatch = typeof domainConfig.match === 'string'
      ? new RegExp(domainConfig.match, 'i')
      : domainConfig.match
  } else {
    // regexp is auto-generated out of domain list
    domainConfig._compiledMatch = new RegExp('^(https?:)?//(www[.])?(' +
                           dList.map(escapeRe).join('|') +
                           ')/', 'i')
  }

  this._domains.push(domainConfig)

  this._matchAllRE = new RegExp(
    this._domains.map(dc => dc._compiledMatch.source).join('|'),
    'i'
  )
}

// Internal method to perform an http(s) request, it's supposed to be used
// in fetchers. You can override it with custom implementation (for example,
// if you want to avoid http requests at all and use cache only, you can
// replace this with a stub).
//
Unshort.prototype.request = function (url, options) {
  const opts = merge({}, this._options, options || {})

  return got(url, opts)
}

// Expand an URL
//
//  - url      (String)   - url to expand
//
Unshort.prototype.expand = function (url) {
  return this._expand(url)
}

// Internal method that expands url recursively up to `nesting` times,
// on each execution it parses input url and calls a fetcher of the
// matching domain.
//
Unshort.prototype._expand = async function (origUrl) {
  let url = origUrl
  let shouldCache = false
  let nestingLeft = this.nesting

  for (; nestingLeft >= 0; nestingLeft--) {
    let hash = ''

    //
    // Normalize url & pre-validate
    //

    let u = mdurl.parse(url, true)

    if (!u.protocol) {
      // set protocol for relative links like `//example.com`
      u.protocol = 'http:'
    }

    // user-submitted url has weird protocol, just return `null` in this case
    if (u.protocol !== 'http:' && u.protocol !== 'https:') break

    if (u.hash) {
      // Copying browser-like behavior here: if we're not redirected to a hash,
      // but original url has one, set it as a final hash.
      hash = u.hash
      u.hash = ''
    }

    const urlNormalized = mdurl.format(u)

    //
    // At top level try cache first. On recursive calls skip cache.
    // !! Cache should be probed even for disabled services, to resolve old links.
    //
    let result

    if (nestingLeft === this.nesting) {
      result = await this.cache.get(urlNormalized)

      // If cache exists - use it.
      if (result || result === null) {
        // forward hash if needed
        if (hash && result) {
          u = mdurl.parse(result, true)
          u.hash = u.hash || hash
          result = mdurl.format(u)
        }

        return result
      }
    }

    //
    // First pass validation (quick).
    //

    if (!this._matchAllRE.test(urlNormalized)) break

    // Something found - run additional checks.

    const domainConfig = this._domains.find(dc => dc._compiledMatch.exec(urlNormalized))

    if (!domainConfig || !domainConfig.validate(urlNormalized)) break

    // Valid redirector => should cache result
    shouldCache = true

    result = await domainConfig.fetch.call(this, urlNormalized, domainConfig)

    // If unshortener has persistent fail - stop.
    if (!result) break

    // Parse and check url
    //
    u = mdurl.parse(result, true)

    if (!u.hostname) {
      // relative urls are not supported for now
      throw new UnshortError('Redirected to an invalid location', 'EBADREDIRECT')
    }

    if (u.protocol && u.protocol !== 'http:' && u.protocol !== 'https:') {
      // Accept:
      //
      //  - http:// protocol (e.g. http://example.org/)
      //  - https:// protocol (e.g. https://example.org/)
      //  - protocol-relative links (e.g. //example.org/)
      //
      // Restriction is done for security reasons. Even though browsers
      // can redirect anywhere, most shorteners have similar restrictions.
      //
      throw new UnshortError('Redirected to an invalid location', 'EBADREDIRECT')
    }

    // restore hash if needed
    if (hash && !u.hash) {
      u.hash = hash
      result = mdurl.format(u)
    }

    url = result
  }

  if (nestingLeft < 0) {
    throw new UnshortError('Too many redirects', 'EBADREDIRECT')
  }

  const result = (url !== origUrl) ? url : null

  if (shouldCache) {
    // Cache result.
    // !! use normalized original URL for cache key.
    const uo = mdurl.parse(origUrl, true)

    uo.hash = ''
    uo.protocol = uo.protocol || 'http'

    await this.cache.set(mdurl.format(uo), result)
  }

  return result
}

Unshort.prototype._isRedirect = function (code) {
  return [301, 302, 303, 307, 308].includes(code)
}

// Default fetcher, it requests an url and retrieves url it redirects to
// using following data sources:
//
//  - "Location" header if response code is 3xx
//  - <meta http-equiv="refresh"> meta tag
//  - $(selector).attr('href, src') if selector is specified
//
Unshort.prototype._defaultFetch = async function (url, options) {
  let res

  try {
    res = await this.request(url)
  } catch (e) {
    if (e.statusCode >= 400 && e.statusCode < 500) return null

    throw new UnshortError(
      `Remote server error, code ${e.code}, statusCode ${e.statusCode}`,
      'EHTTP',
      e.statusCode)
  }

  if (this._isRedirect(res.statusCode)) {
    return res.headers.location ? res.headers.location.trim() : null
  }

  if (res.statusCode >= 200 && res.statusCode < 300) {
    if (!res.headers['content-type'] ||
        res.headers['content-type'].split(';')[0].trim() !== 'text/html') {
      return null
    }

    const body = String(res.body)

    if (options.link_selector) {
      // try to lookup selector if it's defined in the config
      const el = $(body).find(options.link_selector)
      const result = el.attr('href')

      if (result) return result.trim()
    }

    // try <meta http-equiv="refresh" content="..."> tag
    let refresh = $(body)
      .find('meta[http-equiv="refresh"]')
      .attr('content')

    if (!refresh) return null

    // parse meta-tag and remove timeout,
    // refresh at this point is like `0.5; url=http://example.org`
    refresh = refresh.replace(/^[^;]+;\s*url=/i, '').trim()

    return refresh
  }

  throw new UnshortError(
    `Remote server error, code ${res.code}, statusCode ${res.statusCode}`,
    'EHTTP',
    res.statusCode)
}

module.exports = Unshort
