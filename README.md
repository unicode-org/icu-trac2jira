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
        "id": "tracid"
    },
    "old2new": {
        "path": "../trac-old2new.json",
        "traclinks": "../traclinks.d",
        "base": "https://unicode-org.atlassian.net/browse"
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

to make the trac links:

`node dumplink.js`

- Copyright (C) 2016 and later: Unicode, Inc. and others.
- License & terms of use: http://www.unicode.org/copyright.html
- see [LICENSE](LICENSE)
