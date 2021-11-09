const {stringify} = require('csv');

const fs = require('fs');

const unknownUsers = JSON.parse(fs.readFileSync('./unknownUsers.json', 'utf-8'));

const asRows = (unknownUsers.map(a => [a]));

const withHeader = [ ['tracid','jiraaccount'] ] . concat(asRows);

// console.dir(withHeader);

stringify(withHeader, (err, out) => {
    if(err) return console.error(err);
    fs.writeFileSync('new-unknownUsers.csv', out, 'utf-8');
});
