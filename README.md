# url-unshort

[![CI](https://github.com/nodeca/url-unshort/actions/workflows/ci.yml/badge.svg)](https://github.com/nodeca/url-unshort/actions/workflows/ci.yml)
[![NPM version](https://img.shields.io/npm/v/url-unshort.svg?style=flat)](https://www.npmjs.org/package/url-unshort)

> This library expands urls provided by url shortening services (see [full list](https://github.com/nodeca/url-unshort/blob/master/domains.yml)).


## Why should I use it?

It has been [argued](http://joshua.schachter.org/2009/04/on-url-shorteners) that
“shorteners are bad for the ecosystem as a whole”. In particular, if you're
running a forum or a blog, such services might cause trouble for your users:

 - such links load slower than usual (shortening services require an extra DNS
   and HTTP request)
 - it adds another point of failure (should this service go down, the links will
   die; [301works](https://archive.org/details/301works) tries to solve this,
   but it's better to avoid the issue in the first place)
 - users don't see where the link points to (tinyurl previews don't *really*
   solve this)
 - it can be used for user activity tracking
 - certain shortening services are displaying ads before redirect
 - shortening services can be malicious or be hacked so they could redirect to
   a completely different place next month

Also, short links are used to bypass the spam filters. So if you're implementing
a domain black list for your blog comments, you might want to check where all
those short links *actually* point to.


## Installation

```js
$ npm install url-unshort
```

## Basic usage

```js
const uu = require('url-unshort')()

try {
  const url = await uu.expand('http://goo.gl/HwUfwd')

  if (url) console.log('Original url is: ${url}')
  else console.log('This url can\'t be expanded')

} catch (err) {
  console.log(err);
}
```

## Retrying errors

Temporary network errors are retried automatically once (`options.request.retry=1` by default).

You may choose to retry some errors after an extended period of time using code like this:

```js
const uu = require('url-unshort')()
const { isErrorFatal } = require('url-unshort')
let tries = 0

while (true) {
  try {
    tries++
    const url = await uu.expand('http://goo.gl/HwUfwd')

    // If url is expanded, it returns string (expanded url);
    // "undefined" is returned if service is unknown
    if (url) console.log(`Original url is: ${url}`)
    else console.log("This url can't be expanded")
    break

  } catch (err) {
    // use isErrorFatal function to check if url can be retried or not
    if (isErrorFatal(err)) {
      // this url can't be expanded (e.g. 404 error)
      console.log(`Unshort error (fatal): ${err}`)
      break
    }

    // Temporary error, trying again in 10 minutes
    // (5xx errors, ECONNRESET, etc.)
    console.log(`Unshort error (retrying): ${err}`)
    if (tries >= 3) {
      console.log(`Too many errors, aborting`)
      break
    }
    await new Promise(resolve => setTimeout(resolve, 10 * 60 * 1000))
  }
}
```


## API

### Creating an instance

When you create an instance, you can pass an options object to fine-tune unshortener behavior.

```js
const uu = require('url-unshort')({
  nesting: 3,
  cache: {
    get: async key => {},
    set: async (key, value) => {}
  }
});
```

Available options are:

- **nesting** (Number, default: `3`) - stop resolving urls
  when `nesting` amount of redirects is reached.

  It happens if one shortening service refers to a link belonging to
  another shortening service which in turn points to yet another one
  and so on.

  If this limit is reached, `expand()` will return an error.

- **cache** (Object) - set a custom cache implementation (e.g. if you wish
  to store urls in Redis).

  You need to specify 2 promise-based functions, `set(key, value)` & `get(key)`.

- **request** (Object) - default options for
  [got](https://github.com/sindresorhus/got) in `.request()` method. Can be
  used to set custom `User-Agent` and other headers.


### uu.expand(url) -> Promise

Expand an URL supplied. If we don't know how to expand it, returns `null`.

```js
const uu = require('url-unshort')();

try {
  const url = await uu.expand('http://goo.gl/HwUfwd')

  if (url) console.log('Original url is: ${url}')
  // no shortening service or an unknown one is used
  else console.log('This url can\'t be expanded')

} catch (err) {
  console.log(err)
}
```

### uu.add(domain [, options])

Add a new url shortening service (domain name or an array of them) to the white
list of domains we know how to expand.

```js
uu.add([ 'tinyurl.com', 'bit.ly' ])
```

The default behavior will be to follow the URL with a HEAD request and check
the status code. If it's `3xx`, return the `Location` header. You can override
this behavior by supplying your own function in options.

Options:

- **aliases** (Array) - Optional. List of alternate domaine names, if exist.
- **match** (String|RegExp) - Optional. Custom regexp to use for URL match.
  For example, if you need to match wildcard prefixes or country-specific
  suffixes. If used with `validate`, then regexp may be not precise, only to
  filter out noise. If `match` not passed, then exact value auto-generated from
  `domain` & `aliases`.
- **validate** (Function) - Optional. Does exact URL check, when complex logic
  required and regexp is not enouth (when `match` is only preliminary). See
  `./lib/providers/*` for example.
- **fetch**  (Function) - Optional. Specifies custom function to retrieve expanded
  url, see `./lib/providers/*` for examples. If not set - default method used
  (it checks 30X redirect codes & `<meta http-equiv="refresh" content='...'>`
  in HTML).
- **link_selector** (String) - Optional. Some sites may return HTML pages instead
  of 302 redirects. This option allows use jquery-like selector to extract
  `<a href="...">` value.

Example:

```js
const uu = require('url-unshort')()

uu.add('notlong.com', {
  match: '^(https?:)//[a-zA-Z0-9_-]+[.]notlong[.]com/'
})

uu.add('tw.gs', {
  link_selector: '#lurllink > a'
})
```

### uu.remove(domain)

(String|Array|Undefined). Opposite to `.add()`. Remove selected domains from
instance config. If no params passed - remove everything.


## Security considerations

Only `http` and `https` protocols are allowed in the output. Browsers technically
support redirects to other protocols (like `ftp` or `magnet`), but most url
shortening services limit redirects to `http` and `https` anyway. In case
service redirects to an unknown protocol, `expand()` will return an error.

`expand()` function returns url from the url shortening **as is** without any
escaping or even ensuring that the url is valid. If you want to guarantee a
valid url as an output, you're encouraged to re-encode it like this:

```js
var URL = require('url');

url = await uu.expand('http://goo.gl/HwUfwd')

if (url) url = URL.format(URL.parse(url, null, true))

console.log(url));
```

## License

[MIT](https://raw.github.com/nodeca/url-unshort/master/LICENSE)
