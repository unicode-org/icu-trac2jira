// 1. Copy the 'tracid \t jira account \t github id' content from the spreadsheet into jiramap.csv
// 2. run `node updateReporterMap.js`
// 3. check the diff and commit `reporterMap.json`

const fs = require('fs');

const reporterMap = require('./reporterMap');
const jiraMap = fs.readFileSync('./jiramap.tsv', 'utf-8').split('\n');

let emptyJira = new Set();

for(line of jiraMap) {
    const [trac,ignore, accountId,github] = line.split('\t');
    // console.dir({trac,jira,github});
    if(trac === 'trac-id') {
        continue; // skip header
    }
    if(!trac) {
        console.log('Skipping empty trac id: ' + line);
        continue;
    }
    if(!accountId) {
        // console.log('SKipping empty jira: ' + line);
        emptyJira.add(trac);
        continue;
    }

    if(reporterMap) {
        if(!reporterMap[trac]) {
            console.log('NEW', trac);
            reporterMap[trac]={ github, accountId };
        } else {
            const n = reporterMap[trac];
            if(github && n.github != github) {
                console.log(trac, 'update github', github);
                n.github = github;
            }
            if(accountId && n.accountId != accountId) {
                console.log(trac, 'update accountId', accountId);
                n.accountId = accountId;
            }
        }
    }
}

if(emptyJira.size > 0) {
    console.log(emptyJira.size +  ' Empty jira (skipped): '  + Array.from(emptyJira).toString());
}

fs.writeFileSync('./reporterMap.json', JSON.stringify(reporterMap, null, ' '));