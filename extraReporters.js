// Copyright (C) 2016-2021 and later: Unicode, Inc. and others.
// License & terms of use: http://www.unicode.org/copyright.html

// This module parses the 'unknownUsers.csv' file.

const {parse} = require('csv');
const fs = require('fs');

module.exports = function() {
    return new Promise((resolve, reject) => {
        const rawdata = fs.readFileSync('unknownUsers.csv');
        parse(rawdata, (err, records) => {
            if(err) return reject(err);
            return resolve(records);
        });
    });
}