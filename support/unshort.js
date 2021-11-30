#!/usr/bin/env node

'use strict';

/*eslint-disable no-console*/


const params = process.argv.slice(2);

if (!params.length) {
  console.error('Usage: unshort.js URL');
  return;
}

const url = params[0];

require('../')().expand(url).then((to) => {
  console.log(to);
});
