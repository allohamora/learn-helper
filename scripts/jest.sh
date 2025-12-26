# Path to test file supplied by VSCode Jest Runner
path=$1
# Test name supplied by VSCode Jest Runner
testName=$3

type=$(echo "$path" | sed 's/.*\/__tests__\///' | sed 's/\/.*//')

testScriptName() {
  if [ "$type" = "unit" ]; then
    echo "test"
  else
    echo "test:$type"
  fi
}

eval "npm run $(testScriptName) -- $path -t '$testName'"
