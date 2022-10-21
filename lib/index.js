// Main class
//

'use strict'

const $ = require('cheerio/lib/slim').load('')
const read = require('fs').readFileSync
const yaml = require('js-yaml')
const path = require('path')
const punycode = require('punycode/')
const got = require('got')
const escapeRe = require('escape-string-regexp')
const merge = require('lodash.merge')
const URL = require('url').URL
const UnshortError = require('./error')
const pkg = require('../package.json')

const config = yaml.load(read(path.join(__dirname, '..', 'domains.yml'), 'utf8'))

const defaultAgent = `${pkg.name}/${pkg.version} (+https://github.com/nodeca/url-unshort)`

const defaultOptions = {
  timeout: 30 * 1000,
  retry: 1,
  followRedirect: false, // redirects are handled manually
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
  this._sites = []
  this._compiled_sites = []

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

  // Merge config data & custom providers
  config.forEach(site => {
    let domain, options

    if (typeof site === 'string') {
      [domain, options] = [site, {}]
    } else {
      [domain, options] = Object.entries(site)[0]
    }

    if (customProviders[domain]) {
      Object.assign(options, customProviders[domain])
    }

    this.add(domain, options)
  })
}

// Remove previously added domain.
//
//  - domain (String|Array) - list of domain names (leave undefined to drop all)
//
Unshort.prototype.remove = function (domain) {
  if (!domain) {
    this._sites.length = 0
  } else if (!Array.isArray(domain)) {
    this._sites = this._sites.filter(s => s.id !== domain)
  } else {
    for (const d of domain) {
      this._sites = this._sites.filter(s => s.id !== d)
    }
  }

  this._compile()
}

// Add a domain name to the list of known domains
//
//  - domain (String|Array) - list of domain names
//  - options (Object)       - options for these domains
//    - link_selector (String)  - jquery-like selector to retrieve url with
//    - match (String|RegExp)   - custom regexp to use to match this domain
//    - fetch (Function)         - custom function to retrieve expanded url
//
Unshort.prototype.add = function (domain, options = {}) {
  if (Array.isArray(domain)) {
    for (const d of domain) {
      this._sites.push(Object.assign({ id: d }, options))
    }
  } else {
    this._sites.push(Object.assign({ id: domain }, options))
  }

  this._compile()
}

// Normalize site data:
//
// - create default handlers if not exist
// - build `match` regexp, depending on other fields
//
// Returns normalized object, suitable for unified processing.
//
Unshort.prototype._compileSingle = function (site) {
  // Prepare list of all the domain names, including aliases
  // and punycode variations
  let dList = [site.id].concat(site.aliases || [])

  // create variations + make unique
  dList = Array.from(new Set(
    dList.map(punycode.toASCII).concat(dList.map(punycode.toUnicode))
  ))

  let match

  if (site.match) {
    // regexp is specified by a user
    match = typeof site.match === 'string'
      ? new RegExp(site.match, 'i')
      : site.match
  } else {
    // regexp is auto-generated out of domain list
    match = new RegExp(
      `^(https?:)?//(www[.])?(${dList.map(escapeRe).join('|')})/`,
      'i'
    )
  }

  return Object.assign(
    { fetch: this._defaultFetch, validate: () => true },
    site,
    { match }
  )
}

// Rebuild all regexps & default handlers for fast run
Unshort.prototype._compile = function () {
  this._compiled_sites.length = 0

  for (const site of this._sites) {
    this._compiled_sites.push(this._compileSingle(site))
  }

  // Create global search regexp
  this._matchAllRE = new RegExp(
    this._compiled_sites.map(cs => cs.match.source).join('|'),
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

  return got(url, opts).catch(err => {
    let statusCode = err.statusCode

    if (err.code === 'ERR_NON_2XX_3XX_RESPONSE' && err.response) {
      // https://github.com/sindresorhus/got/blob/main/documentation/8-errors.md
      statusCode = err.response.statusCode
    }

    throw new UnshortError(
      `Remote server error, code ${err.code}, statusCode ${statusCode}`,
      'EHTTP',
      statusCode)
  })
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
  if (origUrl.startsWith('//')) {
    try {
      /* eslint-disable no-new */
      new URL(origUrl)
    } catch (e) {
      try {
        // set protocol for relative links like `//example.com`
        new URL('http:' + origUrl)
        origUrl = 'http:' + origUrl
      } catch {}
    }
  }

  let url = origUrl
  let shouldCache = false
  let nestingLeft = this.nesting

  for (; nestingLeft >= 0; nestingLeft--) {
    let hash = ''

    //
    // Normalize url & pre-validate
    //

    let u = new URL(url)

    // user-submitted url has weird protocol, just return `null` in this case
    if (u.protocol !== 'http:' && u.protocol !== 'https:') break

    if (u.hash) {
      // Copying browser-like behavior here: if we're not redirected to a hash,
      // but original url has one, set it as a final hash.
      hash = u.hash
      u.hash = ''
    }

    const urlNormalized = u.toString()

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
          u = new URL(result)
          u.hash = u.hash || hash
          result = u.toString()
        }

        return result
      }
    }

    //
    // First pass validation (quick).
    //

    if (!this._matchAllRE.test(urlNormalized)) break

    // Something found - run additional checks.

    const siteConfig = this._compiled_sites.find(cs => cs.match.exec(urlNormalized))

    if (!siteConfig || !siteConfig.validate(urlNormalized)) break

    // Valid redirector => should cache result
    shouldCache = true

    result = await siteConfig.fetch.call(this, urlNormalized, siteConfig)

    // If unshortener has persistent fail - stop.
    if (!result) break

    // Parse and check url
    //
    try {
      u = new URL(result)
    } catch (e) {
      if (e instanceof TypeError && e.message === 'Invalid URL') {
        throw new UnshortError('Redirected to an invalid location', 'EBADREDIRECT')
      }

      throw e
    }

    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      // Accept:
      //
      //  - http:// protocol (e.g. http://example.org/)
      //  - https:// protocol (e.g. https://example.org/)
      //
      // Restriction is done for security reasons. Even though browsers
      // can redirect anywhere, most shorteners have similar restrictions.
      //
      throw new UnshortError('Redirected to an invalid location', 'EBADREDIRECT')
    }

    // restore hash if needed
    if (hash && !u.hash) {
      u.hash = hash
      result = u.toString()
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
    const uo = new URL(origUrl)

    uo.hash = ''

    await this.cache.set(uo.toString(), result)
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
    throw e
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
