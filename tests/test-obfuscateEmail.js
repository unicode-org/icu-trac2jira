// Part of ICU tools
// Copyright (C) 2016 and later: Unicode, Inc. and others.
// License & terms of use: http://www.unicode.org/copyright.html

const obfuscate = require('../lib/obfuscateEmail');
const {test} = require('tap');

function checkit(t, e, expect) {
    t.strictEqual(obfuscate(e), expect, `obfuscating ${e}`);
}

test('obfuscation', t => {
    t.ok(obfuscate);
    checkit(t, null, null);
    checkit(t, '', '');
    checkit(t, 'srl', 'srl');
    checkit(t, 'srl@example.com', 'srl@5ababd603b227803');
    checkit(t, 'srl@bar.example.com', 'srl@60cbb1fb33352cc5');

    // make sure it works again!
    checkit(t, 'srl@example.com', 'srl@5ababd603b227803');
    checkit(t, 'srl@bar.example.com', 'srl@60cbb1fb33352cc5');
    t.end();
});
