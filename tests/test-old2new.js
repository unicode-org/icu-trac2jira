const {test} = require('tap');
const Old2New = require('../lib/old2new');
test('basic', t => {
    const o2n = new Old2New();
    t.ok(o2n);
    t.ok(o2n.db);
    t.end();
});

test('rewrite', t => {
    const o2n = new Old2New();
    t.ok(o2n);
    t.notOk(o2n.getJiraId(1234));
    o2n.putJiraId(1234, 5678);
    t.ok(o2n.getJiraId(1234));
    t.strictEqual(o2n.getJiraId(1234), 5678);
    // await o2n.write('/tmp/foo.json');
    t.end();
});

test('persist', async t => {
    const o2n = new Old2New();
    t.ok(o2n);
    t.notOk(o2n.getJiraId(1234));
    await o2n.read('tests/old2new-persist.json');
    t.ok(o2n.getJiraId(1234));
    t.strictEqual(o2n.getJiraId(1234), 5678);
    o2n.putJiraId(4321, 8765);
    await o2n.write('tests/old2new-persist-out.json');
    const o2nb = new Old2New();
    await o2nb.read('tests/old2new-persist-out.json');
    t.strictEqual(o2nb.getJiraId(4321), 8765);
    t.end();
});