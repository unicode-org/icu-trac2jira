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
            let [id, url] = r.split(/\s+/);
            if(url.indexOf('$') < 0) {
                url = url + '$1';
            }
            return {id, url, title, 
                regex: RegExp(`${id}:([0-9a-zA-Z.+-_]+)`, 'gi'),
                replace: `[$&|${url}]`};
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
        const {config,rev2ticket} = o;
        let {text} = o;


        text = text
            .replace(/\[comment:([^\]]+)\]/g, '(Comment $1)')
            .replace(/^>/gm, 'bq. ')
            .replace(/\[\[BR\]\]/ig, '\\\\')
            .replace(/{{{#!([a-z0-9]+)/g, '{code:$1}') // map {{{ and }}}
            .replace(/{{{.*/g, '{code}') // map {{{ and }}}
            .replace(/}}}/g, '{code}')
            .replace(/\[([^ \]]+)[ ]*([^\]]+)[ ]*\]/g, '[$2|$1]')
            .replace(/\b(#|ticket:|icubug:)([0-9]+)\b/ig, `[${config.project.name}-$2]`)
            .replace(/\wr([0-9]+)/g, (match, id) => `${match} ([${config.project.name}-${rev2ticket[id]||'unknown'}])`)
            ;

        // Finally, InterMapTxt links
        for(const {regex,replace} of this.map) {
            text = text.replace(regex, replace);
        }

        return text;
    }
}

module.exports = InterMap;