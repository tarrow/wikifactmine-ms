while read p; do
  # curl -H "Content-Type: application/json" -X POST -d "`cat querybyDocument.json | sed s/FooBarBaz/$p/`" "http://localhost:9200/wikifactmine-facts-v3/_search" > $p-sample.json
  node csvSuggestions.js $p-sample.json > $p-Suggestions.csv
done < dictlist.txt