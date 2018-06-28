# USAGE:
# ./scripts/create_issues.sh username:password 10

DIR="$(dirname "$0")"
$DIR/n_issue_jsons.sh $2 | \
curl -v \
	--user $1 \
	--request POST \
	--data @- \
	--header 'Accept: application/json' \
	--header 'Content-Type: application/json' \
	--url 'https://unicode-org.atlassian.net/rest/api/2/issue/bulk';
echo
echo $?
