// countdown for recording gesture, timer UI
let preRecordTime = 3.15 // 3 2 1 countdown - slightly calibrated to align with the audio clip

let recordCountdownTime = 2.0; // time to record gesture = 2 seconds
let recordCountdownRunning = false;

let timerCountdownTime = 10; // 10 seconds
let timerCountdownRunning = false;

// generalized countdown timer
let countdownTimer = (function (document) {
  let myTimer;

  function start(timeLimit, display, atSetup, toDisplay, atEnd) {
    if(atSetup){
      atSetup(display); // funciton to run when setting up timer
    }

    let time = timeLimit;
    let startTime = new Date().getTime();

    myTimer = setInterval(myClock, 10);

    function myClock() {
      let remaining = time - (new Date().getTime() - startTime) / 1000; // in seconds

      // update countdown timer
      display.innerHTML = toDisplay(remaining);

      if (remaining <= 0) {
        clearInterval(myTimer);
        atEnd(timeLimit, display);
      }
    }
  }
  function reset(timeLimit, display, atEnd){
    clearInterval(myTimer);
    atEnd(timeLimit, display, true);
  }
  return { start: start, reset: reset };
})(document);

String.prototype.toMMSS = function () {
  var sec_num = parseInt(this, 10); // don't forget the second param
  var hours = Math.floor(sec_num / 3600);
  var minutes = Math.floor((sec_num - hours * 3600) / 60);
  var seconds = sec_num - hours * 3600 - minutes * 60;

  if (minutes < 10) {
    minutes = "0" + minutes;
  }
  if (seconds < 10) {
    seconds = "0" + seconds;
  }
  return minutes + ":" + seconds;
};

// gesture-triggered countdown timer
function setTimer() {
  let newTimerLength = prompt(
    "Enter new countdown time (in seconds)",
    timerCountdownTime
  );
  if (parseInt(newTimerLength) !== timerCountdownTime) {
    timerCountdownTime = parseInt(newTimerLength);
    event.target.innerHTML = newTimerLength.toMMSS();
  }
}

// for 3 / 2 / 1 countdown when recording gesture data
function preRecordStart(){
  isCollectingData = true;
}

function preRecordTimeLeft(timeLeft){
  let timeToDisplay = (timeLeft).toFixed(0);
  if(timeToDisplay <= 0){
    timeToDisplay = 1;
  }
  return `......${timeToDisplay}......`;
}

function atPreRecordTimeEnd(defaulTime, display){
  display.innerHTML = `Recording...`;

  // run countdown timer
  countdownTimer.start(recordCountdownTime,
    document.querySelector(`#${currentGesture} .countdown-timer`),
    atRecordTimerStart,
    recordTimerDisplay,
    atRecordTimeEnd);
}

let timerCountdownResetBtn = document.getElementById('timer-countdown-reset-btn');

if(timerCountdownResetBtn){
  timerCountdownResetBtn.onclick = function(){
    countdownTimer.reset(timerCountdownTime, document.getElementById('timer-countdown'), atCountdownTimerEnd);
  };  
}


