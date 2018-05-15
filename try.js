// With ES6
const JiraApi = require('jira-client');
const sqlite = require('sqlite');

const config = require('./config.json');
 
// Initialize
const jira = new JiraApi(config.jira);
/*
1-liner:
const jira = new (require('jira-client')) (require('./config.json').jira);
*/

const dbPromise = sqlite.open(config.db.path, { cached: true });

// LIMIT
const allTickets = dbPromise.then(async (db) => db.all('select * from ticket where id>0 and id <3'));

const ticketCount = dbPromise.then(async (db) => db.get('select count(*) as count from ticket'));

const project = jira.getProject(config.project.name);
const issueTypes = jira.listIssueTypes();

const nameToIssueType = issueTypes.then(async (issueTypes) => issueTypes.reduce((p,v) => {
    p[v.name] = v;
    return p;
}, {}));

const allFields = jira.listFields();

const nameToFieldId = allFields.then(async (allFields) => allFields.reduce((p,v) => {
    p[v.name] = v;
    return p;
}, {}));

/**
 * Return the custom fields for a ticket.
 * THis is a function and a new query to save typing.
 * @param {*} ticket 
 */
async function custom(ticket) {
    const list =  await (await dbPromise).all(`select * from ticket_custom where ticket = ${ticket}`);
    return list.reduce((p,v) => {
        p[v.name]=v.value;
        return p;
    }, {});
}

/**
 * get the latest version of a wiki page
 * @param {String} name 
 */
async function getWiki(name) {
    return (await dbPromise).get(`select * from wiki where name='${name}' order by version desc limit 1;`);
}

const InterMapTxt = getWiki('InterMapTxt')
.then((m) => m.text)
.then((l) => {
    let lines = l.split(/[\r\n]+/);
    lines = lines.slice(lines.indexOf('----')+1);
    lines = lines.slice(lines.indexOf('{{{')+1);
    lines = lines.slice(0,lines.lastIndexOf('}}}'));
    lines = lines.filter((l) => {
        if (!l.trim()) return false;
        if (l[0] === '#') return false;
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
});

async function forTracType(type) {
    const jiraType = config.mapTypes[type];
    if(!jiraType) throw Error(`Unknown trac ticket type ${type} (check mapTypes)`);
    const map = await nameToIssueType;
    const jiraIssueType = map[jiraType];
    if(!jiraIssueType) throw Error(`Unknown Jira type ${jiraType} (for ${type} - check mapTypes and JIRA`);
    console.log(type, jiraType, jiraIssueType);
    return jiraIssueType;
    // (await nameToIssueType)[config.mapTypes[ticket.type]]}    
}

async function doit() {
    const projectId = (await project).id;
    // console.dir(await project);
    // console.dir(await nameToIssueType);
    // return;
    // console.dir(await nameToFieldId);
    console.log(await InterMapTxt);
    return;

    const {count} = await ticketCount;
    console.log(`${count} tickets to process`);
    const all = await allTickets;
    // const custom = await ticketCustom;
    for(ticket of all) {
        const {id, summary, description} = ticket;
        // make custom fields look like real fields
        Object.assign(ticket, await custom(id));
        const {private,sensitive} = ticket;
        const hide = (/*private==='y' ||*/ sensitive == 1);
        if(hide) {
            console.log(`Skipping #${id}: private=${private}, sensitive=${sensitive}`);
            continue;
        }
        console.dir(ticket);
        const fields={
            summary,
            description,
            project: {id: projectId},
            issuetype: {id: (await forTracType(ticket.type)).id }
            // assignee: { name: }
            // priority: {id: }
            // 
        };
        // set the trac id
//        fields[config.mapFields.id] = id;

        console.dir(fields);

        const ret = await jira.addNewIssue({
            fields
        });
        console.dir(ret);
    }
}


doit()
.then((x) => console.dir(x), (e) => {
    if (e.message) { console.error(e.message) } else { console.error(e) } 
});
