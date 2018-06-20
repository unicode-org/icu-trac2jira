to use:
- npm i
- create a `config.json` as follows:

```json
{
    "jira": {
        "protocol": "https",
        "host": "blahblah.atlassian.net",
        "username": "you@you.you",
        "password": "hunter42",
        "apiVersion": "2",
        "strictSSL": true
    },
    "db": {
        "path": "../trac-db2.sqlite"
    },
    "project": {
        "name": "ICU"
    },
    "mapFields": {
        "id": "tracid",
        "owner": "tracOwner",
        "reporter": "tracReporter"
    },
    "mapTypes": {
        "defect": "Bug",
        "enhancement": "New Feature",
        "task": "Task",
        "improvement": "Improvement",
        "design": "Epic"
    },
    "old2new": {
        "path": "../trac-old2new.json",
        "traclinks": "../traclinks.d",
        "base": "https://unicode-org.atlassian.net/browse"
    },
    "reporterMap": {
        "srl": "srl295",
        "srl(at)jtcsv.com": "srl295",
        "somebody": null,
        "shane": "shane",
        "jefgen": "jeff.genovy"
    }
}
```

Notes:
- see the SQL code for `allTickets` in try.js - it controls which tickets will be processed.

- run `node try.js` to run the converter.

- `trac-old2new.json` (path above) will be created if it doesn't exist. This is the persistent DB for mapping trac to jira ids

- to make the trac links:

`node dumplink.js`

… this will output to the `traclinks` directory listed in the config file.


- Copyright (C) 2016 and later: Unicode, Inc. and others.
- License & terms of use: http://www.unicode.org/copyright.html
- see [LICENSE](LICENSE)
