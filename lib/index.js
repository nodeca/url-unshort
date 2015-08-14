// Main class
//

'use strict';


var $          = require('cheerio');
var fs         = require('fs');
var yaml       = require('js-yaml');
var _          = require('lodash');
var mdurl      = require('mdurl');
var path       = require('path');
var punycode   = require('punycode');
var request    = require('request');
var requireAll = require('require-all');

var configFile = path.join(__dirname, '..', 'domains.yml');
var config     = yaml.safeLoad(fs.readFileSync(configFile, 'utf8'));


// Create an unshortener instance
//
// options:
//  - cache   (Object) - cache instance
//    - get(key, callback)
//    - set(key, value, callback)
//  - nesting (Number) - max amount of redirects to follow, default: `3`
//
function Unshort(options) {
  if (!(this instanceof Unshort)) {
    return new Unshort(options);
  }

  var self = this;

  options = options || {};

  // config data with compiled regexps and fetch functions attached
  this._domains = [];

  this.cache = options.cache || {
    get: function (k, callback)    { callback(); },
    set: function (k, v, callback) { callback(); }
  };

  this.nesting = options.nesting || 3;

  // Regexp that matches links to all the known services, it is used
  // to determine whether url should be processed at all or not.
  //
  // Initialized to regexp that matches nothing, it gets overwritten
  // when domains are added.
  //
  this._matchAllRE = /(?!)/;

  var customProviders = requireAll(path.join(__dirname, 'providers'));

  var domainMap = {};

  config.forEach(function (domain) {
    if (_.isString(domain)) {
      domainMap[domain] = {};
    } else {
      Object.keys(domain).forEach(function (d) {
        domainMap[d] = _.assign({}, domain[d]);
      });
    }
  });

  Object.keys(domainMap).forEach(function (domain) {
    if (customProviders[domain]) {
      domainMap[domain].fetch = customProviders[domain];
    }

    self.add(domain, domainMap[domain]);
  });
}


// Expand an URL
//
//  - url      (String)   - url to expand
//  - callback (Function) - `function (err, fullUrl)`
//
Unshort.prototype.expand = function (url, callback) {
  var self = this;

  self.cache.get(url, function (err, result) {
    if (err) {
      callback(err);
      return;
    }

    if (result) {
      callback(null, result);
      return;
    }

    self._expand(url, self.nesting, function (err, result) {
      if (err) {
        callback(err);
        return;
      }

      self.cache.set(url, result, function (err) {
        if (err) {
          callback(err);
          return;
        }

        callback(null, result);
      });
    });
  });
};


// Add a domain name to the list of known domains
//
//  - domains (String|Array) - list of domain names
//  - options (Object)       - options for these domains
//    - select  (String)        - jquery-like selector to retrieve url with
//    - match   (String|RegExp) - custom regexp to use to match this domain
//    - fetch   (Function)      - custom function to retrieve expanded url
//
Unshort.prototype.add = function (domain, options) {
  var self = this;

  if (Array.isArray(domain)) {
    domain.forEach(function (d) {
      self.add(d, options);
    });

    return;
  }

  var domainConfig = _.assign({}, options);

  if (!domainConfig.fetch) {
    domainConfig.fetch = this._defaultFetch;
  }

  // Prepare list of all the domain names, including aliases
  // and punycode variations
  //
  // e.g. for `➡.ws` this array will contain both encodings of this domain:
  // `[ '➡.ws', 'xn--hgi.ws' ]`
  var domainList = [ domain ].concat(domainConfig.aliases || []);

  domainList = _.uniq(domainList.map(punycode.toASCII).concat(domainList.map(punycode.toUnicode)));

  if (domainConfig.match) {
    // regexp is specified by a user
    if (_.isString(domainConfig.match)) {
      domainConfig._compiledMatch = new RegExp(domainConfig.match, 'i');
    } else {
      domainConfig._compiledMatch = domainConfig.match;
    }
  } else {
    // regexp is auto-generated out of domain list
    domainConfig._compiledMatch = new RegExp('^(https?:)?//(www\.)?(' +
                           domainList.map(_.escapeRegExp).join('|') +
                           ')/', 'i');
  }

  self._domains.push(domainConfig);

  self._matchAllRE = new RegExp(self._domains.map(function (dc) {
    return dc._compiledMatch.source;
  }).join('|'), 'i');
};


// Internal method to perform an http(s) request, it's supposed to be used
// in fetchers. You can override it with custom implementation (for example,
// if you want to avoid http requests at all and use cache only, you can
// replace this with a stub).
//
Unshort.prototype.request = function (options, callback) {
  var cb = _.once(callback);

  // Turn off redirects (handled internally)
  //
  if (typeof options.followRedirect === 'undefined') {
    options.followRedirect = false;
  }

  // Set default timeout to 5 seconds
  //
  if (typeof options.timeout === 'undefined') {
    options.timeout = 5000;
  }

  // Set up a default user-agent
  //
  if (!options.headers) { options.headers = {}; }

  var userAgent = _.find(options.headers, function (v, k) {
    return k.toLowerCase() === 'user-agent';
  });

  if (!userAgent) {
    options.headers['User-Agent'] = 'Link expander, https://github.com/nodeca/url-unshort';
  }

  var req = request(options);

  req.on('response', function (res) {
    var bufs = [];
    var len = 0;

    res.on('data', function (d) {
      len += d.length;
      bufs.push(d);

      if (len > 102400 /* 100kb */) {
        // Assume that regexp shorteners don't return *that* big redirects,
        // so this shouldn't normally be a redirect.
        //
        // Return an empty body so it won't be parsed by a fetcher.
        //
        cb(null, res, '');
        req.destroy();
      }
    });

    res.on('end', function () {
      cb(null, res, Buffer.concat(bufs, len).toString('utf8'));
    });
  });

  req.on('error', function (err) {
    cb(err);
  });
};


// Internal method that expands url recursively up to `nesting` times,
// on each execution it parses input url and calls a fetcher of the
// matching domain.
//
Unshort.prototype._expand = function (url, nestingLeft, callback) {
  if (nestingLeft < 0) {
    callback(new Error('Too many redirects'));
    return;
  }

  var self = this;
  var origUrl = url;
  var u = mdurl.parse(url, true);
  var hash = '';

  if (!self._matchAllRE.test(origUrl)) {
    callback(null, nestingLeft === self.nesting ? null : origUrl);
    return;
  }

  if (!u.protocol) {
    // set protocol for relative links like `//example.com`
    u.protocol = 'http:';
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    // user-submitted url has weird protocol, just return `null` in this case
    callback();
    return;
  }

  if (u.hash) {
    // Copying browser-like behavior here:
    //
    // if we're not redirected to a hash, but original url has one,
    // set it as a final hash
    hash = u.hash;
    u.hash = '';
  }

  var domainConfig = _.find(self._domains, function (dc) {
    return dc._compiledMatch.exec(url);
  });

  domainConfig.fetch.call(self, mdurl.format(u), domainConfig, function (err, result) {
    if (err) {
      callback(err);
      return;
    }

    if (!result) {
      callback(null, nestingLeft === self.nesting ? null : origUrl);
      return;
    }

    // Parse and check url
    //
    var u = mdurl.parse(result, true);

    if (!u.hostname) {
      // relative urls are not supported for now
      callback(new Error('Redirected to an invalid location'));
      return;
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
      callback(new Error('Redirected to an invalid location'));
      return;
    }

    if (hash && !u.hash) {
      // Copying browser-like behavior here:
      //
      // if we're not redirected to a hash, but original url has one,
      // set it as a final hash
      u.hash = hash;
    }

    self._expand(mdurl.format(u), nestingLeft - 1, callback);
  });
};


function isRedirect(code) {
  return code === 301
      || code === 302
      || code === 303
      || code === 307
      || code === 308;
}


// Default fetcher, it requests an url and retrieves url it redirects to
// using following data sources:
//
//  - "Location" header if response code is 3xx
//  - <meta http-equiv="refresh"> meta tag
//  - $(selector).attr('href, src') if selector is specified
//
Unshort.prototype._defaultFetch = function (url, options, callback) {
  this.request({ url: url }, function (err, res, body) {
    if (err) {
      callback(err);
      return;
    }

    if (isRedirect(res.statusCode)) {
      callback(null, res.headers.location ? res.headers.location.trim() : null);
      return;
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (!res.headers['content-type'] ||
          res.headers['content-type'].split(';')[0].trim() !== 'text/html') {

        callback();
        return;
      }

      if (options.select) {
        // try to lookup selector if it's defined in the config
        var el = $(body).find(options.select);
        var result = el.attr('src') || el.attr('href');

        if (result) {
          callback(null, result.trim());
          return;
        }
      }

      // try <meta http-equiv="refresh" content="..."> tag
      var refresh = $(body)
                      .find('meta[http-equiv="refresh"]')
                      .addBack('meta[http-equiv="refresh"]')
                      .attr('content');

      if (!refresh) {
        callback();
        return;
      }

      // parse meta-tag and remove timeout,
      // refresh at this point is like `0.5; url=http://example.org`
      refresh = refresh.replace(/^[^;]+;\s*url=/i, '').trim();

      callback(null, refresh);
      return;
    }

    if (res.statusCode >= 400 && res.statusCode < 500) {
      callback();
      return;
    }

    callback(new Error('Remote server error, code ' + res.statusCode));
  });
};


module.exports = Unshort;
