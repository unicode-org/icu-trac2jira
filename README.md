### ICU's Trac to JIRA converter

to use:
- npm i
- you will need a `reporterMap.json` file also
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
    }
}
```



Notes:

- this is an incremental conversion. you can run it lots of times.

- with 2fa use an API token instead of your password - https://id.atlassian.com/manage/api-tokens#

- to just convert 1 ticket: `node try.js 'where id=13472'`

- run `node try.js` to run the converter.

- `trac-old2new.json` (path above) will be created if it doesn't exist. This is the persistent DB for mapping trac to jira ids

- to make the trac links:

`node dumplink.js`

… this will output to the `traclinks` directory listed in the config file.


- Copyright (C) 2016 and later: Unicode, Inc. and others.
- License & terms of use: http://www.unicode.org/copyright.html
- see [LICENSE](LICENSE)
