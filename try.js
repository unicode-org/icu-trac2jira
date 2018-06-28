// With ES6
const JiraApi = require('jira-client');
const sqlite = require('sqlite');
const isFilePromise = require('is-file-promise');
const config = require('./config.json');

config.reporterMap = require('./reporterMap.json'); // ask sffc for this

const InterMap = require('./lib/intermap');

// Initialize
const jira = new JiraApi(config.jira);
/*
1-liner:
const jira = new (require('jira-client')) (require('./config.json').jira);
*/

// Promise for main Trac DB
const dbPromise = sqlite.open(config.db.path, { cached: true });
// const Old2New = require('./lib/old2new');

const ticketwhere = process.argv[2] || '';

console.log('ticket filter:', ticketwhere);
// return;

// const o2n = geto2n(config.old2new.path);

// @@@ NOTE: this controls which tickets are imported. 
const allTickets = dbPromise.then(async (db) => db.all(`select * from ticket ${ticketwhere}`));


/*
 * ticket|time|author|field|oldvalue|newvalue
 * 13828|1528927025850017|shane|comment|3|LGTM
 */
const allCommentsByTicket = dbPromise.then(async (db) => db.all(`select * from ticket_change where field='comment' order by time`))
.then((all) => all.reduce((p,v) => {
    const o = p[v.ticket] = p[v.ticket] || [];
    o.push(v);
    return p;
}, {}));

const maxTicket = dbPromise.then(async (db) => (await db.get('select id from ticket order by id DESC limit 1')).id);

const allComponents = dbPromise.then(async (db) => db.all('select * from component'));

const rev2ticket = dbPromise.then(async (db) => db.all('select * from rev2ticket'))
.then((all) => all.reduce((p,v) => {
    p[v.rev] = v.ticket;
    return p;
}, {}));

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
// async function geto2n(path) {
//     const o2n = new Old2New();
//     try {
//         const isDir =  isFilePromise(path).catch(()=>false);
//         if(await isDir) {
//             await o2n.read(path);
//         } else {
//             console.log('No o2n at ',path,', setting up new');
//         }
//     } catch(e) {
//         console.error('skipping o2n read of', path, 'because', e);
//     }
//     return o2n;
// }

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
    // console.log(type, jiraType, jiraIssueType);
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

const updTix = {};
const errTix = {};
let scanno = 0;

async function doit() {
    const projectId = (await project).id;
    const {count} = await ticketCount;
    console.log(` tickets to process`);

    console.log(`trac: count ${count}, max ${await maxTicket}`);
    // console.dir(await project);
    // return;
    // console.dir(await nameToIssueType);
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
    
    const all = await allTickets;
    // const custom = await ticketCustom;

    console.log('Skipping ticket creation. Going right to ticket update');
    console.log('Getting tickets created..');
    // STEP 1 - get all summaries in 
    for(ticket of all) {
        scanno++;
        // console.log('Considering', ticket);
        const {id, summary, description} = ticket;
        console.log(id, summary);
        // return;
        // make custom fields look like real fields
        Object.assign(ticket, await custom(id));
        const {component, owner, private,sensitive, reporter} = ticket;
        const hide = (/*private==='y' ||*/ sensitive == 1);
        // const jiraId = (await o2n).getJiraId(id);
        const issueKey =  `${config.project.name}-${id}`;
        const jiraIssue = await jira.findIssue(
            issueKey,
            null, '', //expand,
            null, //fields,
            'description', //properties,
            //fieldsByKeys
        ).catch((e) => {
            console.error(e);
            process.exitCode=1;
            console.error(`Could not load issue ${issueKey} — ${e}. `);
            next;
        });
        console.dir(ticket, {color: true, depth: Infinity});
        console.dir(jiraIssue, {color: true, depth: Infinity});
        jiraId = jiraIssue.id;
        // unpack fields
        const fields = {};

        // Set any fields that are wrong.
        {
            const {components, description, issuetype, summary, reporter, assignee} = jiraIssue.fields;

            // Issue Type.
            jiraIssueType = (await forTracType(ticket.type));
            console.log(issuetype.id, jiraIssueType.id);
            if (issuetype.id !== jiraIssueType.id) {
                fields.issuetype = {id: jiraIssueType.id};
            }

            // Summary.
            if(summary !== ticket.summary) {
                fields.summary = ticket.summary;
            }

            // Description - rendered
            const newDescription = (await InterMapTxt).render({text: ticket.description, ticket, config, project, rev2ticket: await rev2ticket});
            if(description !== newDescription) {
                fields.description = newDescription;
            }

            // Reporter
            // Trac reporter
            const reporterKey = (config.reporterMap[ticket.reporter] || config.reporterMap.nobody || {}).name;
            if(reporterKey && reporterKey != (reporter||{}).name) {
                // JIRA reporter
                fields.reporter = { name: reporterKey };
            }

            // Reporter
            // Trac reporter
            const ownerKey = (config.reporterMap[ticket.owner] || config.reporterMap.nobody || {}).name;
            if(ownerKey && ownerKey != (assignee||{}).name) {
                // JIRA reporter
                fields.assignee = { name: ownerKey };
            }

            function setIfNotSet(k,v) {
                if(jiraIssue.fields[k] !== v) {
                    fields[k] = v;
                }
            }

            setIfNotSet(await getFieldIdFromMap('id'), id.toString());
            setIfNotSet(await getFieldIdFromMap('reporter'), ticket.reporter);
            setIfNotSet(await getFieldIdFromMap('owner'), ticket.owner);
            {
                const timeField = await getFieldIdFromMap('time');
                const jiraTime = new Date(jiraIssue.fields[timeField] || 0);
                const tracTime = new Date(ticket.time/1000);
                if(jiraTime.toDateString() !== tracTime.toDateString()) {
                    // only if off by a day!
                    setIfNotSet(await getFieldIdFromMap('time'), new Date(ticket.time/1000).toISOString());
                }
            }

            // Component is an array
            const componentId = await nameToComponentId(component);
            if((components[0] || {}).id !== componentId) {
                fields.components = [{id: componentId }];
            }
        }

        if(Object.keys(fields).length > 0) {
            console.dir({id, issueKey, jiraId, fields}, {color: true, depth: Infinity});
            const ret = await jira.updateIssue(issueKey, {fields, notifyUsers: false})
            .catch((e) => {
                errTix[jiraId] = e.errors || e.message || e.toString();
                // console.error(e);
                return {error: e.errorss || e.message || e.toString()};
            });
            updTix[jiraId] =  ret;
            console.dir(ret);
        } else {
            console.log('No change:', id, issueKey, jiraId);
        }

        // const ret = await jira.addNewIssue({
        //     fields
        // });
        // // console.dir(ret);
        // console.log(id, ret.key);
        // const {key} = ret;
        // {
        //     const [proj,jiraId] = key.split(/-/);
        //     if(proj !== config.project.name) {
        //         console.error('Expected project',config.project.name,'but got',proj);
        //     } else {
        //         (await o2n).putJiraId(id, jiraId);
        //     }
        // }
        // // just in case - write every 10
        // if(wrtno>10) {
        //     (await o2n).write(config.old2new.path);
        //     wrtno = 0;
        // }
        // wrtno++;
    }

}

/**
 * Give a summary
 */
function postscript() {
    console.log();
    if(errTix && Object.keys(errTix).length > 0) {
        process.exitCode = 1;
        console.dir(errTix, {depth: Infinity, color: true});
        console.error(`Error in ${Object.keys(errTix).length} tickets.`);
    }
    if(updTix) {
        console.log(`Updated ${Object.keys(updTix).length}/${scanno} tickets.`);
    }
}

doit()
.then((x) => {
    console.dir(x);
    postscript();
    
}, (e) => {
    if (e.message) { console.error(e.message) } else { 
        process.exitCode = 1;
        console.error(e);
        postscript();
    }
});
