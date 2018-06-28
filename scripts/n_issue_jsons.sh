#!/bin/bash

echo '{ "issueUpdates": [';

for i in `seq 1 $1`;
do
	if [ $i -ne 1 ]; then echo ","; fi
	(
		cd "$(dirname "$0")";
		cat empty_issue.json;
	)
done

echo '] }'
