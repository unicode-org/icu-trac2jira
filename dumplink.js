const config = require('./config.json');
const fs = require('fs');
const Old2New = require('./lib/old2new');
const path = require('path');
const linkPath = config.old2new.traclinks;

async function doit() {
    const o2n = new Old2New();
    await o2n.read(config.old2new.path);
    for(const o of o2n.all) {
        console.dir(o);
        const {tracId, jiraId} = o;
        const theDir = path.resolve(linkPath, `${tracId}`);
        const theFile = path.resolve(theDir, `index.html`);
        fs.mkdirSync(theDir);
        fs.writeFileSync(theFile, `trac #${tracId} = <a href='${config.old2new.base}/${config.project.name}-${jiraId}'>${config.project.name}-${jiraId}</a>`, 'utf-8');
    }
}

doit().then((r) => console.dir(r), (e) => console.error(e));