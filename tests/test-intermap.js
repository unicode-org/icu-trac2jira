const fs = require('fs');
const {test} = require('tap');
const InterMap = require('../lib/intermap');
const testmap = [
{ id: 'c2Wiki',
    url: 'http://c2.com/cgi/wiki?',
    title: undefined },
  { id: 'WikiPedia',
    url: 'http://en.wikipedia.org/wiki/',
    title: undefined },
  { id: 'ChromeBug',
    url: 'http://code.google.com/p/chromium/issues/detail?id=',
    title: 'Chromium issue $1' }
];

test('parse', t => {
    const data = fs.readFileSync('./tests/InterMapTxt.txt', 'utf-8').toString();
    t.ok(data);
    map = new InterMap(data);
    t.ok(map);
    t.ok(map.map);
    t.ok(map.map[0].id);
    t.end();
});