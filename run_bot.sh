#!/bin/bash

cd $(dirname $0)

while read line; do export "$line";
done < .env

# Sometimes Trove errors out.
# Just wait a bit and retry until we are successul.
while true; do
  node bot.js; status=$?
  if [ ${status} -eq 0 ]; then
    exit 0;
  fi
  sleep 30
done
