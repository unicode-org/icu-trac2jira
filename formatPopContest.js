// Copyright (C) 2016-2021 and later: Unicode, Inc. and others.
// License & terms of use: http://www.unicode.org/copyright.html

// Run this to format the 'unknownContest.json' file and print it out.

function formatPopContest(contest) {
    const entries = Object.entries(contest);
    entries.sort((a, b) => b[1] - a[1]);
    return entries;
}

module.exports = formatPopContest;


if (require.main === module) {
    const unknownContest = require('./unknownContest.json')
    const data = formatPopContest(unknownContest);

    console.dir(data);
}