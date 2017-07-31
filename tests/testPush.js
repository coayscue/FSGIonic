global.env = {
  "IONIC": {
    "apiKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkMDY1ODg4MC01YzY0LTRhM2MtYmUxOS0wN2QwYjRhMjkzNzEifQ.euJHqKnm-pWbIq70X4txVgUkBtoqjIVcZbRRxpopB7c",
    "pushProfile": "christian"
  }
}
var push = require('./../server/app/helpers/pushNotifications.js');

push(["25d3ec0cb17e9bc1bc37aedb557ed1fc8b8a73e9d57b9c25f566b6bd2891edf4"], "Hello Michael", "I hope you enjoyed your flight. <3 Chill");
