var mongoose = require('mongoose');
var ConnectDots = mongoose.model('ConnectDots');
var HeadTilt = mongoose.model('HeadTilt');
var lodash = require("lodash");

var router = require('express').Router();
module.exports = router;

var stages = ["look left", "look right", "look up", "look down", "left eye", "right eye", "smile"];

router.get('/getdots', function(req, res, next) {
  var dots = [];
  for (var i = 0; i < 3; i++) {
    dots.push({
      x: Math.floor(Math.random() * Number(req.query.width - 40)) + 20,
      y: Math.floor(Math.random() * Number(req.query.height - 70)) + 50
    });
  }
  var newObj = new ConnectDots({
    session: req.query.session,
    type: 'dotAuth',
    dots: dots
  })
  newObj.save().then(function(ok) {}).then(null, console.log);
  res.send(dots);
})

router.post('/dotresults', function(req, res, next) {
  var points = req.body.touchPoints.map(function(point) {
    var replaced = point.replace("(", "").replace(")", "").split(", ");
    return {
      x: Number(replaced[0]),
      y: Number(replaced[1])
    }
  })
  ConnectDots.findOne({
    'session': req.body.session,
    'type': 'dotAuth'
  }).then(function(connectDots) {
    var dotsLeft = connectDots.dots;
    points.forEach(function(point) {
      dotsLeft = dotsLeft.filter(function(dot) {
        return ((Math.sqrt(Math.pow(point.x - dot.x, 2) + Math.pow(point.y - dot.y, 2)) >= 20))
      })
    })

    if (areHuman(dotsLeft, points)) {
      console.log("passed");
      connectDots.points = points;
      connectDots.passed = true;

      connectDots.save()
      res.send({
        done: true
      })
    } else {
      console.log("failed");
      connectDots.passed = false;
      connectDots.save();
      res.send({
        done: false
      })
    }
  }).then(null, next);
})

function areHuman(dotsLeft, points) {
  var slopes = [];
  var prevPoint = {
    x: 0,
    y: 0
  }
  points.forEach(function(point) {
    var slope = (prevPoint.y - point.y) / (prevPoint.x - point.x);
    if (!slopes.includes(slope)) slopes.push(slope);
    prevPoint = point;
  })

  return (slopes.length > points.length * 0.2)
}

router.get("/headTilt", function(req, res, next) {
  var newHT = new HeadTilt({
    session: req.query.session,
    stages: lodash.shuffle(stages),
    failed: false,
    complete: false,
    lastTimestamp: new Date(),
    stageStep: 0,
    faceVideo: "",
    startDate: new Date()
  })
  newHT.save();
  res.send({
    created: true,
    nextStep: newHT.stages[0]
  });
})

router.get("/headTiltData", function(req, res, next) {
  for (var key in req.query.dots) {
    var point = req.query.dots[key];
    var replaced = point.replace("(", "").replace(")", "").split(", ");
    req.query.dots[key] = {
      x: Number(replaced[0]),
      y: Number(replaced[1])
    }
  }
  HeadTilt.findOne({
    session: req.query.session
  }).then(function(ht) {
    ht.prevFaces.push(JSON.stringify(req.query));
    var passed = false;
    switch (ht.stages[ht.stageStep]) {
      case "look left":
      passed = (req.query.eulerAngleY < -25);
      break;
      case "look right":
      passed = (req.query.eulerAngleY > 25);
      break;
      case "look up":
      passed = (Math.abs((req.query.dots.leftEye.y - req.query.dots.noseBase.y) + (req.query.dots.rightEye.y - req.query.dots.noseBase.y)) < Math.abs((req.query.dots.noseBase.y - req.query.dots.leftCheek.y) + (req.query.dots.noseBase.y - req.query.dots.rightCheek.y)));
      break;
      case "look down":
      passed = (((req.query.dots.noseBase.y - req.query.dots.leftCheek.y) + (req.query.dots.noseBase.y - req.query.dots.rightCheek.y)) > 0);
      break;
      case "left eye":
      passed = (req.query.leftEyeOpen < .5 && req.query.rightEyeOpen > 0.8);
      break;
      case "right eye":
      passed = (req.query.rightEyeOpen < .5 && req.query.leftEyeOpen > 0.8);
      break;
      case "smile":
      passed = (req.query.smiling > .7);
      break;
    }
    if (passed) {
      ht.stageStep += 1;
      ht.lastTimestamp = new Date();
      if (ht.stageStep == ht.stages.length) {
        if (lodash.uniq(ht.prevFaces).length != ht.prevFaces.length || (new Date().getTime() - ht.startDate.getTime()) / 1000 < ht.prevFaces.length * 0.8) ht.failed = true;
        res.send({
          complete: true,
        })
      } else {
        ht.complete = true;
        res.send({
          complete: false,
          nextStep: ht.stages[ht.stageStep]
        });
      }
    } else {
      if (ht.lastTimestamp && new Date(req.query.timestamp).getTime() - ht.lastTimestamp.getTime() > 6000) {
        console.log("failed - " + ht.stages[ht.stageStep]);
        ht.failed = true;
      }
      res.send({
        complete: false,
        nextStep: ""
      })
    }
    ht.save();
  }).then(null, next);
})