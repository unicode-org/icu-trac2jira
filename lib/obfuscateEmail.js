const {createHash} = require('crypto');

module.exports = function obfuscateEmail(e) {
    if(!e) return e;
    e = e.trim();
    if(e.indexOf('@') < 0) return e;
    let [ local, host ] = e.split('@');
    const hash = createHash('md5');
    hash.update(host);
    host = hash.digest('hex').substring(0,16);
    return [ local, host ].join('@');
};