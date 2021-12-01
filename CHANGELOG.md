6.0.0 / WIP
------------------

- Cleanup deprecated redirectors. Move deprecation info to separate file.
- node.js v14+ required.
- Deps bump.


5.0.0 / 2017-06-08
------------------

- Switch to native async/await (need nodejs 7.+)
- Drop callbacks support.


4.1.0 / 2017-06-08
------------------

- Maintenance, deps bump. `got` 6.x -> 7.x. `got` timeouts may work a bit
  different but should affect result.


4.0.0 / 2016-12-08
------------------

- Move request options to `options.request`.
- Update default User-Agent string.
- Deprecate `error.status` (use `error.statusCode`).
- Add more info (code) to error messages.
- flic.kr should use `.request()` method.
- Increase default request timeout to 30 seconds.


3.1.0 / 2016-12-05
------------------

 - `err.status` -> `err.statusCode` (old `err.status` still exists for backward
   compatibility, but will be deprecated).


3.0.0 / 2016-11-27
------------------

- Rewrite internals to promises (including .require() / cache.get() /
  cache.set()).
- Drop old node.js support, now v4.+ required.


2.1.0 / 2016-07-15
------------------

- Added `google.*/url` unshortening.
- Reenabled some glitching services.
- Added incident dates to default config for tracking progress in future.


2.0.0 / 2016-05-24
------------------

- Added Promise support in `.expand` method.
- Services cleanup.


1.1.3 / 2016-01-17
------------------

- Maintenance: deps update.


1.1.2 / 2015-12-07
------------------

- Enchanced error info with `code` & `status` properties.


1.1.1 / 2015-11-27
------------------

- Improved cache use for edge case with empty result.


1.1.0 / 2015-11-25
------------------

- Optimized cache use. Store data only if fetch happened.
- Increased request timeout to 10 seconds.


1.0.1 / 2015-10-28
------------------

- Added `vk.com/away.php` support.


1.0.0 / 2015-08-16
------------------

- First release.
