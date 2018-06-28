class InterMap {
    static parseLines(l) {
        let lines = l.split(/[\r\n]+/);
        lines = lines.slice(lines.indexOf('----')+1);
        lines = lines.slice(lines.indexOf('{{{')+1);
        lines = lines.slice(0,lines.lastIndexOf('}}}'));
        lines = lines.filter((l) => {
            l = l.trim();
            if (!l[0] || l[0] === '#') return false;
            return true;
        });
        lines = lines.map((l) => {
            let r = l.trim();
            // const { a,b } = r.split(/\s*#\s*/);
            const hash = r.indexOf('#');
            let title;
            if(hash>0) {
                title = r.substring(hash+1).trim();
                r = r.substring(0,hash).trim();
            }
            const [id, url] = r.split(/\s+/);
            return {id, url, title};
        });
        return lines;
        /*
        { id: 'RFC',
        url: 'http://www.ietf.org/rfc/rfc$1.txt',
        title: 'IETF\'s RFC $1' },
    { id: 'Acronym',
        url: 'http://www.acronymfinder.com/af-query.asp?String=exact&Acronym=',
        title: undefined },
        */
    }

    /**
     * @param {String|Object} l - original text, or object form of map
     */
    constructor(l) {
        if(typeof l === 'string') {
            // parse string to object
            l = InterMap.parseLines(l);
        }
        this._map = l;
    }

    get map() {
        return this._map;
    }

    render(o) {
        const {text} = o;

        return text; // punt
    }
}

module.exports = InterMap;
