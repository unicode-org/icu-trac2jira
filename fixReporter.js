// Part of ICU tools
// Copyright (C) 2016-2021 and later: Unicode, Inc. and others.
// License & terms of use: http://www.unicode.org/copyright.html

// With ES6
const JiraApi = require('jira-client');
// const sqlite = require('sqlite');
const isFilePromise = require('is-file-promise');
const config = require('./config.json');
const fs = require('fs');
const obfuscate = require('./lib/obfuscateEmail');
const mkdirp = require('mkdirp-then');
const chalk = require('chalk');
const path = require('path');
const humanizeDuration = require('humanize-duration')

config.reporterMap = require('./reporterMap.json'); // ask sffc for this

const InterMap = require('./lib/intermap');

// Initialize
const jira = new JiraApi(require('./local-auth.json').jira);
/*
1-liner:
const jira = new (require('jira-client')) (require('./config.json').jira);
*/

let startTimeMs;
function elapsedTimeMs() {
    return new Date().getTime() - startTimeMs;
}


// Fetch users that we don't have the name for
async function getUserByAccountId(accountId) {
    return jira.doRequest(jira.makeRequestHeader(jira.makeUri({
        pathname: "/user?accountId=".concat(accountId)
    })));
}

function myFindIssue(issueKey) {
    return jira.findIssue(
        issueKey,
        null, '', //expand,
        null, //fields,
        'description', //properties,
        //fieldsByKeys
    );
}

async function deleteAttachment(attachmentId) {
    // DELETE /rest/api/2/attachment/{id}
    return jira.doRequest(jira.makeRequestHeader(jira.makeUri({
        pathname: "/attachment/".concat(attachmentId),
    }),
        {
            followAllRedirects: true,
            method: 'DELETE'
        }));
}

const ticketwhere = process.argv[2] || `project = ${config.project.name} and reporter = ${config.reporterMap.nobody.accountId} and tracReporter is not EMPTY`;

console.log('ticket filter:', ticketwhere);

/**
 * This always returns something valid. can be an accountid
 * @param {String} tracReporter - trac id
 */
function getReporter(tracReporter) {
    if (!tracReporter) return null;
    // Trac reporter
    let reporterEntry = config.reporterMap[tracReporter] || config.reporterMap.nobody;
    if (!reporterEntry.name && !reporterEntry.accountId) {
        throw Error('No name or key for ' + tracReporter + ' - ' + JSON.stringify(reporterEntry));
    }
    return reporterEntry;
}

/**
 * @param {String} tracReporter - trac id
 */
async function getReporterWithName(tracReporter) {
    if (!tracReporter) return null;
    let reporterEntry = config.reporterMap[tracReporter];
    if (!reporterEntry) return null;

    if (!reporterEntry.name && reporterEntry.accountId) {
        // Go fish.
        const reporterValue = await getUserByAccountId(reporterEntry.accountId);
        // console.dir(reporterValue);
        // throw Error('Foo');
        reporterEntry.name = reporterValue.name;
        reporterEntry.key = reporterEntry.key;
        reporterEntry.displayName = reporterEntry.displayName;

        // console.log('Resolved', reporterValue.name, 'from', reporterEntry.accountId);
    }
    return reporterEntry;
}

const project = jira.getProject(config.project.name);
const issueTypes = jira.listIssueTypes();
const components = jira.listComponents(config.project.name);
const priorities = jira.listPriorities(config.project.name);
const versions = jira.getVersions(config.project.name);
const statuses = jira.listStatus/*…es*/(); // https://english.stackexchange.com/a/43324
const nameToIssueType = issueTypes.then(async (issueTypes) => issueTypes.reduce((p, v) => {
    p[v.name] = v;
    return p;
}, {}));

const allFields = jira.listFields();


const nameToFieldId = allFields.then(async (allFields) => allFields.reduce((p, v) => {
    p[v.name] = v;
    return p;
}, {}));

async function fieldIdToName(f) {
    const n2f = await nameToFieldId;
    for ([k, v] of Object.entries(n2f)) {
        if (v && (v.id === f)) return k;
    }
    return f;
}

const _nameToComponent = components.then(async (allFields) => allFields.reduce((p, v) => {
    p[v.name] = v;
    return p;
}, {}));

const _nameToPriority = priorities.then(async (allFields) => allFields.reduce((p, v) => {
    p[v.name] = v;
    return p;
}, {}));

const _nameToVersion = versions.then(async (allFields) => allFields.reduce((p, v) => {
    p[v.name] = v;
    return p;
}, {}));

// copy and paste much?
const _nameToStatus = statuses.then(async (allFields) => allFields.reduce((p, v) => {
    p[v.name] = v;
    return p;
}, {}));

async function nameToComponentId(name) {
    const n2c = await _nameToComponent;
    const info = n2c[name];
    if (!info) return null;
    const { id } = info;
    if (id) return id;
}

async function nameToVersionId(name) {
    const n2c = await _nameToVersion;
    const info = n2c[name];
    if (!info) return null;
    const { id } = info;
    if (id) return id;
}

async function nameToPriorityId(name) {
    const n2c = await _nameToPriority;
    const info = n2c[name];
    if (!info) return null;
    const { id } = info;
    if (id) return id;
}
async function nameToStatusId(name) {
    const n2c = await _nameToStatus;
    const info = n2c[name];
    if (!info) return null;
    const { id } = info;
    if (id) return id;
}

/**
 * Return the custom fields for a ticket.
 * THis is a function and a new query to save typing.
 * @param {*} ticket
 */
async function custom(ticket) {
    const list = await (await dbPromise).all(`select * from ticket_custom where ticket = ${ticket}`);
    return list.reduce((p, v) => {
        p[v.name] = v.value;
        return p;
    }, {});
}

async function forJiraIssueType(type, jiraType) {
    const map = await nameToIssueType;
    const jiraIssueType = map[jiraType];
    if (!jiraIssueType) throw Error(`Unknown Jira type ${jiraType} (for ${type} - check mapTypes and JIRA`);
    // console.log(type, jiraType, jiraIssueType);
    return jiraIssueType;
    // (await nameToIssueType)[config.mapTypes[ticket.type]]}
}

async function getFieldIdFromMap(mapId) {
    const customName = config.mapFields[mapId];
    if (!customName) throw Error(`no customName for ${mapId}`);
    const subMap = await nameToFieldId;
    if (!subMap[customName]) throw Error(`Need to create custom field ${customName}`);
    const { key, id } = subMap[customName];
    // console.log(subMap[customName].id)
    if (!key && !id) throw Error(`No key or id for ${customName} (${mapId}) - have ${Object.keys(subMap[customName])}`);
    // console.log(mapId,customName,customId);
    return key || id;
}

const updTix = {};
const errTix = {};
let scanno = 0;
let batchno = 0;
const maxResults = 5000;

const extraReporters = require('./extraReporters');

async function doit() {


    const extraRecords = await extraReporters();

    for (row of extraRecords) {
        const [forTrac, forJira] = row;
        let accountId = forJira;
        if (!forJira || !forTrac) continue;
        if (forTrac === 'tracid' || forTrac[0] === '#') continue;
        // console.dir(row);
        if (!config.reporterMap[forTrac]) {
            config.reporterMap[forTrac] = {};
        }
        if (forJira.startsWith("http") || forJira.startsWith("https")) {
            const lastSlash = forJira.lastIndexOf('/');
            accountId = forJira.substring(lastSlash+1);
            // console.log(forJira, accountId);
        }
        if (config.reporterMap[forTrac].accountId &&
            config.reporterMap[forTrac].accountId !== accountId) {
            console.error(`DUP in unknownUsers.csv: Already have ${config.reporterMap[tracId].accountId} FOR ${tracId}=${accountId}`);
            return;
        }
        config.reporterMap[forTrac].accountId = accountId;
    }

    const projectId = (await project).id;

    let wasLast = false;
    let startAt = 0;

    const unknownUsers = new Set();
    const unknownContest = {};

    while(!wasLast) {
        batchno = batchno + 1;
        // console.log(` batch ${batchno} from ${startAt}..`);

        // console.dir(await allFields);
        // return;

        const allTickets = jira.searchJira(ticketwhere + '', {
            fields: [
                'reporter',
                'customfield_10017', // tracReporter
                'summary'],
            maxResults,
            startAt
        });

        const {issues, isLast, total} = await allTickets;
        wasLast = isLast || (issues.length === 0);
        const maxTicket = 0;

        // bump startAt
        startAt = startAt + (issues.length);
        // const allTickets = [];

        // console.log(`trac: count ${issues.length}, max ${await maxResults}, total ${total}`);
        // console.dir(await project);
        // return;
        // console.dir(await nameToIssueType);
        // console.dir(await nameToFieldId);
        // console.log(await InterMapTxt);
        // console.log(await components);
        // console.dir(await _nameToComponent);
        // return;
        let addedComps = 0;

        const all = await allTickets;
        // console.dir(all);
        // const custom = await ticketCustom;


        // console.log('Getting tickets to update..');
        for (ticket of issues) {
            scanno = scanno + 1;
            const {id, key, fields} = ticket;
            // console.log('Considering', tickeyket);
            const issueKey = key;
            const {summary, customfield_10017} = await fields;
            process.stdout.write(`${issueKey}: ${chalk.dim.green(summary.substr(0, 40))} `);
            // console.log();
            // console.dir(fields);
            const jiraIssue = ticket;

            if (!jiraIssue) {
                continue; // could not load
            } else if (!startTimeMs) {
                startTimeMs = new Date().getTime();
            } else if ((scanno % 128) === 0) {
                const elapsedTime = elapsedTimeMs();
                const avgTicket = (elapsedTime / scanno);
                const remain = ((total - scanno) * avgTicket);
                process.stdout.write(chalk.white.bold(`\n${batchno}chunks: ${scanno}/${total} ` +
                    `avg @${humanizeDuration(avgTicket)} remain ${humanizeDuration(remain)} ` +
                    `errs=${Number(Object.keys(errTix).length).toLocaleString()}\n`));
            } else {
                process.stdout.write('…');
            }

            // console.dir(ticket, {color: true, depth: Infinity});
            // console.dir(jiraIssue, {color: true, depth: Infinity});
            const jiraId = key;
            // unpack fields
            const newFields = {};

            const mapReporter = config.reporterMap[customfield_10017];

            if (mapReporter && mapReporter.accountId) {
                const {accountId} = mapReporter;
                // console.log(customfield_10017+'>>' + accountId);
                // …
                newFields.reporter = {id: accountId};
            } else {
                unknownUsers.add(customfield_10017);
                unknownContest[customfield_10017] = (unknownContest[customfield_10017]||0) + 1;
            }


            // Set any fields that are wrong.
            if (false) {
                // Warning: component = trac component, components = jira component.   Yeah.
                const { reporter } = jiraIssue.fields;

                // TODO: get from tracReporter
                //setIfNotSet('reporter', await getReporter(ticket.reporter));
                // TODO: get from tracOwner?
                // setIfNotSet('assignee', await getReporter(ticket.owner));

                // Reporter
                // Trac reporter

                function setIfNotSet(k, v) {
                    if (v == '' || !v) v = null; // prevent noise.
                    // console.dir({j: jiraIssue.fields[k], v});
                    if (v && (v.accountId || v.name)) {
                        // its a user.
                        if (!jiraIssue.fields[k] ||
                            jiraIssue.fields[k].accountId !== v.accountId) {
                            newFields[k] = v;
                        } else {
                            // not a partial match.
                        }
                    } else if (v && v.value) {
                        if (!jiraIssue.fields[k] ||
                            jiraIssue.fields[k].value !== v.value) {
                            newFields[k] = v;
                        } else {
                            // not a matched field
                        }
                    } else if (jiraIssue.fields[k] !== v) {
                        // console.dir({j: jiraIssue.fields[k], v});
                        fields[k] = v;
                    }
                }
            }

            // If there's any change, write it.
            if (Object.keys(newFields).length > 0) {
                if (false) console.dir({ id, issueKey, jiraId, fields }, { color: true, depth: Infinity });

                const changedSet = Object.keys(newFields).map(f => fieldIdToName(f));
                process.stdout.write(`\rCHANGE:${chalk.yellow(issueKey)}:${chalk.blue((await Promise.all(changedSet)).join(','))}\r`);
                // console.log(changedSet);
                // console.log();
                if (true) {
                    // console.dir(newFields);

                    const ret = await jira.updateIssue(issueKey, { fields: newFields, notifyUsers: false })
                        .catch((e) => {
                            errTix[issueKey] = (e.errors || e.message || e.toString()) + JSON.stringify(newFields);
                            // console.error(e);
                            return { error: e.errors || e.message || e.toString(), newFields };
                        });
                    if (errTix[issueKey]) {
                        process.stdout.write(`${chalk.red.bold(issueKey)} for = ${newFields.reporter.id} of ${customfield_10017}!\n`);
                    } else {
                        process.stdout.write(`\n`); // \r${chalk.green.bold(issueKey)}!\r`);
                    }
                    updTix[issueKey] = ret;
                    if (false) { // Use this for a one-shot, do one thing and stop.
                        console.dir(ret);
                        throw Error(`Worked for ${issueKey}??`); // STOPSTOP
                    }
            }
            } else {
                process.stdout.write(`\r${issueKey} ${chalk.dim("No Change =======================")}                       \r`);
                // console.log(' ', 'No change:', id, issueKey, jiraId);
            }
        }
    }
    console.log('UNKNOWN tracReporter:');
    console.dir(Array.from(unknownUsers.values()));
    await fs.promises.writeFile("./unknownContest.json", JSON.stringify(unknownContest), null, " ");
    await fs.promises.writeFile("./unknownUsers.json", JSON.stringify(Array.from(unknownUsers.values()), null, " "));
}

/**
 * Give a summary
 */
function postscript() {
    console.log();
    if (errTix && Object.keys(errTix).length > 0) {
        process.exitCode = 1;
        console.dir(errTix, { depth: Infinity, color: true });
        console.error(`${chalk.red('Error')} in ${Object.keys(errTix).length} tickets.`);
    }
    if (updTix) {
        console.log(`Updated ${Object.keys(updTix).length}/${scanno} tickets.`);
    }
}

doit()
    .then((x) => {
        console.log();
        if (x) {
            console.dir(x);
        } else {
            console.log(chalk.bold.green('OK!'));
        }

        postscript();

    }, (e) => {
        if (e.message) { console.error(e) } else {
            process.exitCode = 1;
            console.error(e);
            postscript();
        }
    });

Promise.all([
    // allCommentsByTicket,
    // attachmentsByTicket,
    allFields,
    project, issueTypes,
    //  ticketCount,
    components, priorities, versions, statuses, nameToIssueType,
    jira,
    //  allTickets,

    _nameToComponent,
    _nameToPriority,
    _nameToVersion,
    _nameToStatus,


])  .then(() => { }, (e) => console.error(e))
