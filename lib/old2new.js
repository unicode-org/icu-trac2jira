const fs = require('fs');
const {promisify} = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
/**
 * Map old to new bug numbers
 */
class Old2New {
    
    /**
     * 
     * @param {String} [dbpath=":memory:"] sqlite3 path to db, defaults to ':memory:'
     */
    constructor() {
        this.db = new Map();
    }

    async read(fn) {
        const data = (await readFile(fn, 'utf-8')).toString();
        const o = JSON.parse(data);
        for(const e of o) {
            this.put(e.tracId, e);
        }
    }

    put(tracId, o) {
        this.db.set(tracId, o);
    }

    putJiraId(tracId, jiraId) {
        this.put(tracId, {
            tracId,
            jiraId
        });
    }

    get(tracId) {
        return this.db.get(tracId);
    }

    getJiraId(tracId) {
        const o = this.get(tracId);
        if(!o) return o;
        return o.jiraId;
    }

    write(fn) {
        const out = [];
        for(const v of this.db.values()) {
            out.push(v);
        }
        console.error('writing', fn);
        return writeFile(fn, JSON.stringify(out), 'utf-8');
    }

    /**
     * Returns all
     */
    get all() {
        return this.db.values();
    }
}

module.exports = Old2New;
