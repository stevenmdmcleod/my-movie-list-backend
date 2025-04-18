#!/bin/bash
pgrep -l -f "node app.js" | cut -d ' ' -f 1 | xargs -r sudo kill