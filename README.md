# url-unshort

[![Greenkeeper badge](https://badges.greenkeeper.io/nodeca/url-unshort.svg)](https://greenkeeper.io/)

[![Build Status](https://img.shields.io/travis/nodeca/url-unshort/master.svg?style=flat)](https://travis-ci.org/nodeca/url-unshort)
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
let uu = require('url-unshort')();

uu.expand('http://goo.gl/HwUfwd')
  .then(url => {
    if (url) console.log('Original url is: ${url}');
    // no shortening service or an unknown one is used
    else console.log('This url can\'t be expanded');
  })
  .catch(err => console.log(err));

// or with callback

uu.expand('http://goo.gl/HwUfwd', (err, url) => {
  // connection error or similar
  if (err) {
    console.log(err);
    return;
  }

  if (url) console.log('Original url is: ${url}');
  // no shortening service or an unknown one is used
  else console.log('This url can\'t be expanded');
});

// Or with promise

```

## API

### Creating an instance

When you create an instance, you can pass an options object to fine-tune unshortener behavior.

```js
var uu = require('url-unshort')({
  nesting: 3,
  cache: {
    get: function (key) {}, // -> Promise
    set: function (key, value) {} // -> Promise
  },
});
```

Available options are:

- `nesting` (Number, default: `3`) - stop resolving urls
  when `nesting` amount of redirects is reached.

  It happens if one shortening service refers to a link belonging to
  another shortening service which in turn points to yet another one
  and so on.

  If this limit is reached, `expand()` will return an error.

- `cache` (Object) - set a custom cache implementation (e.g. if you wish
  to store urls in Redis).

  You need to specify 2 promise-based functions, `set(key, value)` & `get(key)`.

- `request` (Object) - default options for
  [got](https://github.com/sindresorhus/got) in `.request()` method. Can be
  used to set custom `User-Agent` and other headers.


### uu.expand(url [, callback]) -> Promise

Expand an URL supplied. If we don't know how to expand it, returns `null`.

```js
let uu = require('url-unshort')();

uu.expand('http://goo.gl/HwUfwd')
  .then(url => {
    if (url) console.log('Original url is: ${url}');
    // no shortening service or an unknown one is used
    else console.log('This url can\'t be expanded');
  })
  .catch(err => console.log(err));

// or with callback

uu.expand('http://goo.gl/HwUfwd', (err, url) => {
  // ...
});

```

### uu.add(domain [, options])

Add a new url shortening service (domain name or an array of them) to the white
list of domains we know how to expand.

If domain name is already added, its configuration gets overwritten.

```js
uu.add([ 'tinyurl.com', 'bit.ly' ]);
```

The default behavior will be to follow the URL with a HEAD request and check
the status code. If it's `3xx`, return the `Location` header. You can override
this behavior by supplying your own function in options.

Options:

 - `select` (String)   - jquery-like selector used to retrieve url from the page
 - `fetch`  (Function) - specify a custom function to retrieve expanded url,
    see `./lib/providers/*` sources for example.
 - `match`  (String|RegExp) - custom regexp to use to match this domain.

So a full-featured example of adding a domain would look like this:


## Security considerations

Only `http` and `https` protocols are allowed in the output. Browsers technically
support redirects to other protocols (like `ftp` or `magnet`), but most url
shortening services limit redirections to `http` and `https` anyway. In case
service redirects to an unknown protocol, `expand()` will return an error.

`expand()` function returns url from the url shortening **as is** without any
escaping or even ensuring that the url is valid. If you want to guarantee a
valid url as an output, you're encouraged to re-encode it like this:

```js
var URL = require('url');

uu.expand('http://goo.gl/HwUfwd')
  .then(url => {
    return url ? URL.format(URL.parse(url, null, true)) : null;
  })
  .then(url => console.log(url));
```

Relative urls without a protocol are accepted, relative urls without a host
name are not. You **can** receive incomplete url like `//example.org` if a
shortening service redirects to it.

## License

[MIT](https://raw.github.com/nodeca/url-unshort/master/LICENSE)
