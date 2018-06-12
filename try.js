// With ES6
const JiraApi = require('jira-client');
const sqlite = require('sqlite');
const isFilePromise = require('is-file-promise');
const config = require('./config.json');

const InterMap = require('./lib/intermap');
// Initialize
const jira = new JiraApi(config.jira);
/*
1-liner:
const jira = new (require('jira-client')) (require('./config.json').jira);
*/

// Promise for main Trac DB
const dbPromise = sqlite.open(config.db.path, { cached: true });
const Old2New = require('./lib/old2new');


const o2n = geto2n(config.old2new.path);

// LIMIT
const allTickets = dbPromise.then(async (db) => db.all('select * from ticket where id=13392'));

const allComponents = dbPromise.then(async (db) => db.all('select * from component'));

const ticketCount = dbPromise.then(async (db) => db.get('select count(*) as count from ticket'));

const project = jira.getProject(config.project.name);
const issueTypes = jira.listIssueTypes();
const components = jira.listComponents(config.project.name);

const nameToIssueType = issueTypes.then(async (issueTypes) => issueTypes.reduce((p,v) => {
    p[v.name] = v;
    return p;
}, {}));

const allFields = jira.listFields();

const nameToFieldId = allFields.then(async (allFields) => allFields.reduce((p,v) => {
    p[v.name] = v;
    return p;
}, {}));

const _nameToComponent = components.then(async (allFields) => allFields.reduce((p,v) => {
    p[v.name] = v;
    return p;
}, {}));

async function nameToComponentId(name) {
    const n2c = await _nameToComponent;
    const info = n2c[name];
    if(!info) return null;
    const {id} = info;
    if(id) return id;
}

/**
 * Start up the 'old2new' machinery. Read existing DB if it exists.
 * @param {String} path 
 */
async function geto2n(path) {
    const o2n = new Old2New();
    try {
        const isDir =  isFilePromise(path).catch(()=>false);
        if(await isDir) {
            await o2n.read(path);
        } else {
            console.log('No o2n at ',path,', setting up new');
        }
    } catch(e) {
        console.error('skipping o2n read of', path, 'because', e);
    }
    return o2n;
}

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
.then((l) => new InterMap(l));

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

function getReporter(r) {
    if(!r) return undefined;
    const name = config.reporterMap[r];
    if(name) {
        return {name};
    } else {
        return undefined;
    }
}

async function getFieldIdFromMap(mapId) {
    const customName = config.mapFields[mapId];
    if (!customName) throw Error(`no customName for ${mapId}`);
    const subMap = await nameToFieldId;
    const {key} = subMap[customName];
    if (!key) throw Error(`No key for ${customName} (${mapId})`);
    // console.log(mapId,customName,customId);
    return key;
}

async function doit() {
    const projectId = (await project).id;

    // console.dir(await project);
    // console.dir(await nameToIssueType);
    // return;
    // console.dir(await nameToFieldId);
    // console.log(await InterMapTxt);
    // console.log(await components);
    // console.dir(await _nameToComponent);
// return;
    let addedComps = 0;
    for(component of (await allComponents)) {
        const {name,description} = component;
        const existingId = await nameToComponentId(name);
        if(!existingId) {
            const body = {
                name,
                description,
                project: config.project.name,
                projectId
            };
            console.log('adding component',name);
            // hack: add it back to the cache
            await jira.addNewComponent(body);
            addedComps++
        }
    }
    if(addedComps) {
        throw Error(`Just added ${addedComps} components ,please try again`);
    }

    // return;
    
    const {count} = await ticketCount;
    console.log(`${count} tickets to process`);
    const all = await allTickets;
    // const custom = await ticketCustom;
    for(ticket of all) {
        const {id, summary, description} = ticket;
        // make custom fields look like real fields
        Object.assign(ticket, await custom(id));
        const {component, owner, private,sensitive, reporter} = ticket;
        const hide = (/*private==='y' ||*/ sensitive == 1);
        const jiraId = (await o2n).getJiraId(id);
        console.dir(ticket);
        if(jiraId) {
            console.log(`Skipping #${id}- already as id ${jiraId}`);
            continue;
        }

        if(hide) {
            console.log(`Skipping #${id}: private=${private}, sensitive=${sensitive}`);
            continue;
        }
        const fields={
            summary,
            description,
            project: {id: projectId},
            issuetype: {id: (await forTracType(ticket.type)).id },
            reporter: getReporter(reporter),
            assignee: getReporter(owner),
            components: [ { id: await nameToComponentId(component)  } ]
        };
        // set the trac id
        fields[await getFieldIdFromMap('id')] = id.toString();
        fields[await getFieldIdFromMap('reporter')] = reporter;
        fields[await getFieldIdFromMap('owner')] = owner;
        
        console.dir(fields);

        const ret = await jira.addNewIssue({
            fields
        });
        console.dir(ret);
        const {key} = ret;
        {
            const [proj,jiraId] = key.split(/-/);
            if(proj !== config.project.name) {
                console.error('Expected project',config.project.name,'but got',proj);
            } else {
                (await o2n).putJiraId(id, jiraId);
            }
        }
    }

    (await o2n).write(config.old2new.path);
}


doit()
.then((x) => console.dir(x), (e) => {
    if (e.message) { console.error(e.message) } else { console.error(e) } 
});
