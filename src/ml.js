// MODEL LOADING PARAMETERS
console.log('ml.js');
let shouldLoadDefaultGestures = false;
let shouldLoadModel = true;

let debugMode = true;

let dataDirectory = "data/";
let modelNeedsTraining = false; // this is a flag to determine when the model needs to be retrained.  
// it's used when a user adds new gestures / removes gestures that the model is already trained to recognize
let dataFromJSON = false; // used to flag whether to add new default gestures

let gestureData = []; // for retraining the model after adding new data

// ml5js
let model;
const numEpochs = 80;

let isCollectingData = false;
let isTraining = false;
let trainedGestures = [];

let pencilIcon = "<i class='fas fa-pencil-alt'></i>";
let showIcon = '<i class="fas fa-eye"></i>';
let hideIcon = '<i class="fas fa-eye-slash"></i>';
let confidenceThreshold = 0.55; // default confidenceThreshold to trigger new gesture

// warning messages
let insufficientDataWarning =
  "You need at least 3 samples for each gesture to train the model.";
let insufficientGesturesWarning =
  "You need at least 2 gestures to train the model. Add some more gestures!";

let removeIcon = '<i class="fas fa-times"></i>';

// p5 / ml5 stuff
function setup() {
  // p5js canvas
  let canvas = createCanvas(250, 200, WEBGL);
  canvas.parent("p5js-container");

  createNeuralNetwork();

  // load default gestures
  if (shouldLoadDefaultGestures) {
    loadDefaultGestures();
  }
}

function createNeuralNetwork() {
  // ml5js neural network
  let options = {
    inputs: [
      "ax_max",
      "ax_min",
      "ax_std",
      "ax_peaks",
      "ay_max",
      "ay_min",
      "ay_std",
      "ay_peaks",
      "az_max",
      "az_min",
      "az_std",
      "az_peaks",
    ],
    outputs: ["gesture"],
    task: "classification",
    debug: "false",
    learningRate: 0.5,
  };

  model = ml5.neuralNetwork(options);
}

// currently drawing box to show microbit orientation
function draw() {
  background(0);
  orbitControl();
  translate(0, 0, 0);
  normalMaterial();
  push();
  rotateX(-asin(sinY));
  rotateY(asin(sinX));
  torus(80, 20);
  pop();
}

function loadDefaultGestures() {
  // load default data
  model.loadData(`${dataDirectory}/gestures.json`, dataLoaded);

  if (shouldLoadModel) {
    // load default model
    const modelInfo = {
      model: `${dataDirectory}/model.json`,
      metadata: `${dataDirectory}/model_meta.json`,
      weights: `${dataDirectory}/model.weights.bin`,
    };

    model.load(modelInfo, modelLoaded);
  }
}

// load data from JSON file
const loadDataInput = document.getElementById("data-upload");
loadDataInput.addEventListener("change", loadData);

function loadData(){
  const loadDataInput = document.getElementById("data-upload");  
  if (loadDataInput.files.length > 0) {
    let confirmation = confirm(
      "The model will be retrained automatically, and all current gestures will be removed.  Are you sure you want to continue?"
    );
    if (confirmation) {

      // remove current default gestures
      document.getElementById('default-gestures').innerHTML = '';
      trainedGestures = [];
      dataFromJSON = true;

      // remove current triggers
      let triggersContent = document.querySelector('#triggers-container .content');
      if(triggersContent){ triggersContent.innerHTML = '';}

      model.loadData(loadDataInput.files, dataLoadedFromFile);
    }
  }
}


function addDefaultGestures() {
  let container = document.getElementById("default-gestures");

  let gestures = getModelGestures();
  trainedGestures = gestures;

  gestures.forEach(function (gestureName) {
    container.append(gestureLabel(gestureName, true));
  });

  updateConfidenceGestures(gestures);
}

function updateConfidenceGestures(gestures){
  let confidenceContainer = document.getElementById('gesture-confidence-container');

  gestures.forEach(function (gestureName){
    // only add if the gesture doesn't already exist
    if(!document.querySelector(`label.${gestureName}`)){
      // console.log('add new confidence container for ', gestureName);
      // add to the confidence container
      let gestureConfidenceContainer = document.createElement('div');
      gestureConfidenceContainer.classList.add(gestureName, 'gestureContainer');
      let label = document.createElement('label');
      label.classList.add(gestureName);
      let labelName = document.createElement('span');
      labelName.innerHTML = gestureName;     
      
      label.append(labelName);
      gestureConfidenceContainer.append(label);
      
      let confidenceSpan = document.createElement('span');
      confidenceSpan.classList.add('confidence', gestureName);
      gestureConfidenceContainer.append(confidenceSpan);

      confidenceContainer.append(gestureConfidenceContainer);
    }

    // remove any gestures that have been removed
    let confidenceGestures = Array.from(document.querySelectorAll(`#gesture-confidence-container .confidence`)).map(item => item.classList.value).map(i => i.replace(i.match("confidence"), "").trim() );
    let removedGestures = confidenceGestures.filter((gesture) => trainedGestures.includes(gesture) == false);
    removedGestures.forEach(function(gestureName){
      document.querySelector(`.gestureContainer.${gestureName}`).remove();
    })
  })
}

function removeGesture(evt) {
  let gestureLabelEl = evt.target.closest("label");
  let gestureName = gestureLabelEl.querySelector(".name").innerHTML;

  let isTrained = gestureLabelEl.classList.contains("trained");

  let isTrainedAlert =
    "Are you sure you want to remove this gesture? You'll have to retrain the model.";
  let isUntrainedAlert = "Are you sure you want to remove this gesture?";
  let alertMsg = isTrained ? isTrainedAlert : isUntrainedAlert;

  let remove = confirm(alertMsg);
  if (remove) {
    console.log("remove ", gestureName);

    if (isTrained) {
      console.log("remove trained gesture");
      if (gestureLabelEl.closest(".gesture-container")) {
        // remove the custom gesture
        gestureLabelEl.closest(".gesture-container").remove();
      } else {
        // remove default gesture
        gestureLabelEl.remove();
      }

      // removed from trainedGestures array
      trainedGestures = trainedGestures.filter(gesture => gesture != gestureName);

      // remove corresponding trigger
      let actionEl = document.querySelector(`.action.${gestureName}`);
      if (actionEl) {
        actionEl.remove();
        modelNeedsTraining = true;
      }

      // remove from timer select
      let option = document.querySelector(`#timer-countdown-trigger-select option[value=${gestureName}]`);
      if(option){
        option.remove();
      }

    } else {
      // remove gestureContainer
      console.log("remove untrained gesture");
      gestureLabelEl.closest(".gesture-container").remove();
    }

    // clean gestureData of this gesture's info
    gestureData = gestureData.filter((data) => data.ys.gesture !== gestureName);

    updateMLBtns();
  }
}

function getModelGestures() {
  // returns all trained gestures
  return model.data.meta.outputs.gesture.uniqueValues;
  /* below is code for getting all gestures from the model data, even if the gestures are untrained */
  // return model.data.data.raw.map(item => item.ys.gesture).filter((item, i, ar) => ar.indexOf(item) === i);;
}

function recordGesture(evt) {
  // disable the recording button

  evt.target.disabled = true;

  let gestureID = evt.target.closest(".gesture-container").id.toLowerCase();
  console.log("recording gestureID: ", gestureID);
  currentGesture = gestureID;
  isCollectingData = true;

  if (!recordCountdownRunning) {
    // first run a 3 / 2 / 1 countdown before recording
    countdownTimer.start(
      preRecordTime,
      evt.target,
      preRecordStart,
      preRecordTimeLeft,
      atPreRecordTimeEnd
    );
  }
}

function gestureLabel(gestureName, isTrained) {
  let label = document.createElement("label");
  let trainLabel = isTrained ? "trained" : "untrained";
  label.classList.add("gesture", trainLabel);
  let labelName = document.createElement("span");
  labelName.classList.add("name");
  labelName.innerHTML = gestureName;
  label.append(labelName);

  let removeBtn = document.createElement("div");
  removeBtn.classList.add("remove");
  removeBtn.innerHTML = removeIcon;
  removeBtn.addEventListener("click", removeGesture);
  label.append(removeBtn);
  return label;
}

function addNewGesture(evt) {
  if (!microbitPaired) {
    alert("Pair your microbit first to begin adding gestures!");
  } else {
    let gestureName = prompt("Enter your gesture name: ", "");

    if (gestureName) {
      if (getCurrentGestures().includes(gestureName)) {
        alert(
          `The name ${gestureName} is already been used. Please choose a new name.`
        );
      } else {
        // format with all lower case and hyphens in place of spaces
        gestureName = gestureName.replace(/\s+/g, "-").toLowerCase();

        // create gesture container UI
        let gestureContainer = document.createElement("div");
        gestureContainer.classList.add(
          "gesture-container",
          "custom-gesture",
          "incomplete"
        );
        gestureContainer.setAttribute("id", gestureName);

        // label.addEventListener("click", renameGesture);
        gestureContainer.append(gestureLabel(gestureName, false));

        // show / hide button
        let toggleDataBtn = document.createElement("button");
        toggleDataBtn.classList.add("toggle-data-btn", "hidden");
        toggleDataBtn.innerHTML = hideIcon + "Hide Data";
        toggleDataBtn.addEventListener("click", function () {
          toggleDataVisibility(gestureName);
        });

        gestureContainer.append(toggleDataBtn);

        let dataContainer = document.createElement("div");
        dataContainer.classList.add("data-container");

        let recordContainer = document.createElement("div");
        recordContainer.classList.add("record-btn-container");

        let recordGestureBtn = document.createElement("button");
        recordGestureBtn.innerHTML = "Record Gesture";
        recordGestureBtn.classList.add("record-btn");
        recordGestureBtn.addEventListener("click", recordGesture);
        recordContainer.append(recordGestureBtn);

        let countdownContainer = document.createElement("div");
        countdownContainer.innerHTML = "2.00"; // two second timer
        countdownContainer.classList.add("countdown-timer");
        recordContainer.append(countdownContainer);
        dataContainer.append(recordContainer);

        let sampleCounter = document.createElement("div");
        sampleCounter.classList.add("sample-counter");
        sampleCounter.innerHTML = `record at least 3 samples`;
        dataContainer.append(sampleCounter);

        let sampleContainer = document.createElement("div");
        sampleContainer.classList.add("sample-container");
        sampleContainer.setAttribute("id", name);
        dataContainer.append(sampleContainer);

        gestureContainer.append(dataContainer);

        let parentContainer = document.getElementById("custom-gestures");
        parentContainer.prepend(gestureContainer);

        updateMLBtns();
      }
    }
  }
}

function toggleDataVisibility(gestureName) {
  let triggerBtn = event.target;

  let dataContainer = document.querySelector(`#${gestureName} .data-container`);
  if (triggerBtn.innerHTML.indexOf(hideIcon) >= 0) {
    triggerBtn.innerHTML = showIcon + "Show Data";
  } else {
    triggerBtn.innerHTML = hideIcon + "Hide Data";
  }
  dataContainer.classList.toggle("hidden");
}

function renameGesture(evt) {
  let newName = prompt("Enter a new name: ", "");
  if (newName.length > 0) {
    evt.target.closest("label").innerHTML = newName + pencilIcon;
  }
}

function enableTrainBtn() {
  let trainModelBtn = document.getElementById("train-btn");
  trainModelBtn.disabled = false;
  trainModelBtn.classList.add("active");
  modelNeedsTraining = true;
}

function disableTrainBtn() {
  let trainModelBtn = document.getElementById("train-btn");
  trainModelBtn.disabled = true;
  trainModelBtn.classList.remove("active");
  modelNeedsTraining = false;
}

function enableSaveModelBtn(){
  let saveModelBtn = document.getElementById('save-model-btn');
  saveModelBtn.disabled = false;
}

function showWarning(msg) {
  let warning = document.getElementById("warning");
  warning.innerHTML = msg;
  warning.classList.remove("hidden");
}

function hideWarning() {
  let warning = document.getElementById("warning");
  warning.classList.add("hidden");
}

function updateMLBtns() {
  let newGestureBtn = document.getElementById("new-gesture-btn");
  let recordGestureBtns = document.getElementsByClassName("record-btn");

  // the train model btn should be disabled if there are any incomplete gestures
  if(dataFromJSON){
    hideWarning();
  }else{
    if (document.getElementsByClassName("incomplete").length > 0) {
      // there are some newly added gestures that don't have enough samples yet - require more samples before retraining
      disableTrainBtn();
      showWarning(insufficientDataWarning);
    } else {
      let trainedGesturesEls = document.querySelectorAll("label.trained");
      let numTrainedGestures = trainedGesturesEls ? trainedGesturesEls.length : 0;
      let untrainedGesturesEls = document.querySelectorAll("label.untrained");
      let numUntrainedGestures = untrainedGesturesEls
        ? untrainedGesturesEls.length
        : 0;
  
      if (numTrainedGestures + numUntrainedGestures < 2) {
        disableTrainBtn();
        showWarning(insufficientGesturesWarning);
      } else {
        if (modelNeedsTraining) {
          // the user has removed gestures and the model needs to be retrained
          enableTrainBtn();
          hideWarning();
        } else if (document.getElementsByClassName("ready").length > 0) {
          // there are new gestures that haven't been added to the model yet
          enableTrainBtn();
          hideWarning();
        } else {
          hideWarning();
        }
      }
  
      if (isTraining) {
        disableTrainBtn();
      }
    }  
  }

  if (isTraining) {
    // don't allow user to restart training if it's already in progress
    disableTrainBtn;
    newGestureBtn.disabled = true;

    Array.from(recordGestureBtns).forEach(function (btn) {
      btn.disabled = true;
    });
  } else {
    // allow users to add new gestures + add new samples
    newGestureBtn.disabled = false;
    Array.from(recordGestureBtns).forEach(function (btn) {
      btn.disabled = false;
    });
  }
}

function addNewData(id) {
  let accelX = accelXSample.slice(0);
  let accelY = accelYSample.slice(0);
  let accelZ = accelZSample.slice(0);

  let inputs = {
    ax_max: Math.max(...accelX),
    ax_min: Math.min(...accelX),
    ax_std: standardDeviation(accelX),
    ax_peaks: peaksArr[0],
    ay_max: Math.max(...accelY),
    ay_min: Math.min(...accelY),
    ay_std: standardDeviation(accelY),
    ay_peaks: peaksArr[1],
    az_max: Math.max(...accelZ),
    az_min: Math.min(...accelZ),
    az_std: standardDeviation(accelZ),
    az_peaks: peaksArr[2],
  };

  let targetGesture = document.querySelector(`#${currentGesture}`).id;

  let target = {
    gesture: targetGesture,
  };

  model.addData(inputs, target);
  

  // add to gestureData JSON
  gestureData.push({
    xs: inputs,
    ys: target,
    id: id,
  });

  // increment sample size
  updateSampleCounter(targetGesture);

  // update training btns
  updateMLBtns();
  console.log(" ");
}

// shown in console UI
function updateStatusContainer(status) {
  let statusLabel = document.getElementById("status-label");
  if(trainedGestures.length > 0){
    statusLabel.innerHTML = "Detected Gesture:";  
  }else{
    statusLabel.innerHTML = 'Add some gestures!';
  }     
  if(trainedGestures.length > 0){
    document.getElementById("status").innerHTML = status;
  }else{
    document.getElementById("status").innerHTML = "";
  }
}

function hideStatusContainer() {
  document.getElementById("status-container").classList.add("hidden");
}

function showStatusContainer() {
  document.getElementById("status-container").classList.remove("hidden");
  if(trainedGestures.length > 0){
    document.getElementById('confidence-slider-container').classList.remove('hidden');
  }
}

function dataLoaded() {
  console.log("loaded data ", model.data);
}

function dataLoadedFromFile(){
  console.log("loaded data from file ", model.data);
  
  gestureData = model.data.data.raw.slice();
  trainedGestures = [];
  modelNeedsTraining = true;

  // train the model
  trainModel();
}

function modelLoaded() {
  console.log("default gestures loaded");

  // populate default gestures container based on model data
  addDefaultGestures();

  gestureData = model.data.data.raw.slice();
  modelNeedsTraining = true;
  runPrediction();
}

function exportData() {
  model.saveData("data_" + new Date().getTime());
}

function trainModel() {
  console.log("train model");

  // toggle training model btn
  let trainBtn = document.getElementById("train-btn");
  trainBtn.innerHTML = "Training...";
  trainBtn.disabled = true;

  if (modelNeedsTraining) {
    // reset model and re-add data
    createNeuralNetwork();
    gestureData.forEach(function (item) {
      let inputs = item.xs;
      let target = item.ys;
      model.addData(inputs, target);
    });
  }

  // export the dataset
  // if(!dataFromJSON){
  //   exportData();
  // }

  model.normalizeData();

  let options = {
    epochs: numEpochs,
  };
  isTraining = true;
  updateMLBtns();

  model.train(options, whileTraining, finishedTraining);
  hideTfConsole();
}

function whileTraining(epoch, loss) {
  let trainProgress = document.getElementById("train-progress");
  trainProgress.innerHTML = `${Math.round((epoch / numEpochs) * 100)}%`;
}

function finishedTraining() {
  currentGesture = undefined;
  console.log("finished training");
  modelNeedsTraining = false;
  isTraining = false;

  // Reset training btn text
  let trainBtn = document.getElementById("train-btn");
  trainBtn.innerHTML = "Train Model";
  document.getElementById("train-progress").innerHTML = "";

  // add new triggers
  updateTriggers();  
  
  // update confidence gestures
  updateConfidenceGestures(model.data.meta.outputs.gesture.uniqueValues);
  showOptions();

  // show status container with prediction
  showStatusContainer();

  // enable debug
  let debugContainer = document.getElementById('debug-container');
  if(debugContainer) debugContainer.classList.remove('hidden');

  // update default gestures if loaded data from JSON
  if(dataFromJSON){
    addDefaultGestures();
    dataFromJSON = false;
  }

  // remove any incomplete flags from gesture-containers
  Array.from(document.getElementsByClassName("ready")).forEach(function (el) {
    el.classList.remove("ready");
    el.querySelector("label").classList.remove("untrained");
    el.querySelector("label").classList.add("trained");
    el.querySelector(".toggle-data-btn").classList.remove("hidden");
    el.querySelector(".toggle-data-btn").click();
  });

  // remove instructions if needed
  let instructions = document.querySelector('#options-container .instructions');
  if(instructions){
    instructions.classList.add('hidden');
  }

  // update training btns
  updateMLBtns();
  enableSaveModelBtn();

  runPrediction();
}

function runPrediction() {
  console.log("run prediction");

  let prediction = setInterval(function () {
    let num_samples = 97; // about 2 seconds worth of data

    if (microbitPaired && !isTraining && accelXArr.length > num_samples) {
      // let num_samples = 1;
      let ax_data = accelXArr.slice(
        Math.max(accelXArr.length - num_samples, 1)
      );
      let ay_data = accelYArr.slice(
        Math.max(accelYArr.length - num_samples, 1)
      );
      let az_data = accelZArr.slice(
        Math.max(accelZArr.length - num_samples, 1)
      );
      // console.log('ax_data', ax_data, 'ay_data', ay_data, 'az_data', az_data);

      let inputs = {
        ax_max: Math.max(...ax_data),
        ax_min: Math.min(...ax_data),
        ax_std: standardDeviation(ax_data),
        ax_peaks: peaks(ax_data).numPeaks,
        ay_max: Math.max(...ay_data),
        ay_min: Math.min(...ay_data),
        ay_std: standardDeviation(ay_data),
        ay_peaks: peaks(ay_data).numPeaks,
        az_max: Math.max(...az_data),
        az_min: Math.min(...az_data),
        az_std: standardDeviation(az_data),
        az_peaks: peaks(az_data).numPeaks,
      };

      model.classify(inputs, predictionResults);
    }
  }, 300); 
}

function predictionResults(error, results) {
  if (error) {
    console.log("prediction result error!");
    console.error(error);
    return;
  }

  // console.log('results: ', results);

  currentState = results[0].label.toLowerCase();
  let confidence = results[0].confidence;  
  // console.log('currentState: ', currentState, ' confidence: ', confidence);

  showConfidence(results);

  if(confidence > confidenceThreshold){
    updateStatusContainer(currentState);

    if(currentState != prevState){
      console.log("");
      console.log("new state: ", currentState);
      // logResults(results);
      if(document.getElementById("loud-select")){
        playAudio(currentState);
      }
  
      // check if should start countdown
      let countdownCheckbox = document.getElementById(
        "timer-countdown-trigger-checkbox"
      );
      if(countdownCheckbox){
        let countdownChecked = countdownCheckbox.checked;
        if (countdownChecked) {
          let countdownTriggerSelect = document.getElementById(
            "timer-countdown-trigger-select"
          );
          let countdownTrigger = countdownTriggerSelect.options[
            countdownTriggerSelect.selectedIndex
          ].value.toLowerCase();
          // console.log('countdownTrigger: ', countdownTrigger);
          if (countdownTrigger == currentState && !timerCountdownRunning) {
    
            countdownTimer.start(
              timerCountdownTime,
              document.getElementById("timer-countdown"),
              atCountdownTimerStart,
              countdownTimerDisplay,
              atCountdownTimerEnd
            );
          }
        }
      }
    }
    prevState = currentState;
  }

  // check if volume confidenceThreshold is met
  if (document.getElementById("loud-select") && isLoud()) {
    startPlayback();
    playAudio("loud");
  }
}

function logResults(result){
  for(i=0; i<result.length; i++){
    console.log(`${result[i].label}: ${result[i].confidence*100}`);
  }
}

function updateTriggers() {
  
  let newGestures = model.data.meta.outputs.gesture.uniqueValues.filter(
    (gesture) => trainedGestures.includes(gesture) == false
  ); // newly added gestures

  newGestures.forEach(function (gesture) {
    if(document.getElementById('triggers-container')){
      console.log("adding trigger element for ", gesture);
      // add a new trigger element
      let triggersContainer = document.querySelector("#triggers-container .content");
      let newTriggerContainer = document.createElement("div");
      newTriggerContainer.classList.add("action", gesture);

      let descriptionContainer = document.createElement("div");
      descriptionContainer.classList.add("description");

      let gestureSelectContainer = document.createElement("select");
      gestureSelectContainer.setAttribute("id", `${gesture}-select`);
      // add defualt audio elements
      gestureSelectContainer.innerHTML = `<option value="none"> None</option>
        <option value="random">🔀 Random</option>
        <option value="silence">🔇 Silence</option>
        `;
      gestureSelectContainer.classList.add("audio-select");

      descriptionContainer.innerHTML = `On <label>${gesture}</label>, play sound<br/>`;
      descriptionContainer.append(gestureSelectContainer);
      newTriggerContainer.append(descriptionContainer);
      triggersContainer.prepend(newTriggerContainer);
      populateSelects();

      // update timer trigger
      let timerTrigger = document.getElementById(
        "timer-countdown-trigger-select"
      );
      timerTrigger.options.add(new Option(gesture, gesture));
    }
  });

  trainedGestures = getModelGestures();
  console.log('trainedGestures: ', trainedGestures);
}

function saveModel() {
  model.save();
}

function hideTfConsole() {
  document.getElementById("tfjs-visor-container").style.display = "none";
}

function showTfConsole() {
  document.getElementById("tfjs-visor-container").style.display = "inline";
}

function getCurrentGestures() {
  // this is a list of all gestures on the page, both trained and untrained
  // used to determine if there's a naming conflict
  return [...new Set(gestureData.map((item) => item.ys.gesture))];
}

// record timer functions
function atRecordTimerStart(display) {
  recordCountdownRunning = true;
  display.classList.add("active");
  accelXSample = [];
  accelYSample = [];
  accelZSample = [];
}

function recordTimerDisplay(timeLeft) {
  return timeLeft.toFixed(2);
}

function atRecordTimeEnd(timeLimit, display) {
  isCollectingData = false;
  recordCountdownRunning = false;
  display.innerHTML = timeLimit.toFixed(2); // initial countdown time with two decimal places
  display.classList.remove("active");

  let recordBtn = document.querySelector(`#${currentGesture} .record-btn`);
  recordBtn.disabled = false;
  recordBtn.innerHTML = "Record Gesture";

  let dataId = new Date().getTime();

  let parentContainer = document.querySelector(`#${currentGesture} .sample-container`);
  generatePlotly(dataId, parentContainer, accelXSample, accelYSample, accelZSample);

  // add data
  addNewData(dataId);
}

// countdown timer functions
function atCountdownTimerStart() {
  timerCountdownRunning = true;
  // check whether to loop audio
  let countdownStartSelect = document.getElementById(
    "timer-countdown-start-select"
  );
  let audioFileName = countdownStartSelect.options[
    countdownStartSelect.selectedIndex
  ].value.toLowerCase();
  let audioEl = document.getElementById(audioFileName + "-audio");
  if (
    document.getElementById("timer-countdown-start-loop-checkbox").checked &&
    audioEl
  ) {
    audioEl.loop = true;
  } else if (audioEl) {
    audioEl.loop = false;
  }

  // play audio
  playAudio("timer-countdown-start");
}

// returns content to display in the timer display element
function countdownTimerDisplay(timeLeft) {
  minutes = parseInt(timeLeft / 60, 10);
  seconds = parseInt(timeLeft % 60, 10);

  minutes = minutes < 10 ? "0" + minutes : minutes;
  seconds = seconds < 10 ? "0" + seconds : seconds;
  return minutes + ":" + seconds;
}

function atCountdownTimerEnd(defaultTime, display, isFromReset) {
    stopAllAudio();
    timerCountdownRunning = false;
    display.innerHTML = defaultTime.toString().toMMSS();
    if(!isFromReset){
      playAudio("timer-countdown-end");
    }
}

// CONFIDENCE ADJUSTMENTS - THRESHOLD TO TRIGGER NEW GESTURE

function adjustConfidence(value){
  confidenceThreshold = value / 100;
  document.getElementById('confidence-threshold').innerHTML = value + "%";
}

function showConfidence(predictionResults){
  predictionResults.forEach(function (gesture, index) {
    // find the container and update its value
    let confidenceContainer = document.querySelector(`#gesture-confidence-container .confidence.${gesture.label}`);
    let confidence = (gesture.confidence * 100).toFixed(0)
    confidenceContainer.innerHTML = confidence + "%";
    
    let label = document.querySelector(`#gesture-confidence-container label.${gesture.label}`);
    
    if(gesture.confidence > confidenceThreshold){
      if(index == 0){
        label.classList.add('active');
      }
    }else if(index !==0) {
      label.classList.remove('active');
    }
  });
}

function toggleOptions(){
  let optionsContainer = document.querySelector('#options-container');
  let isMinimized = optionsContainer.classList.contains('minimized');
  optionsContainer.classList.toggle('minimized');

  // update caret content
  let caret = document.getElementById('options-expand-btn')
  if(isMinimized){
    caret.innerHTML = '<i class="fas fa-chevron-up"></i>';	
  }else{
    caret.innerHTML = '<i class="fas fa-chevron-down"></i>';
  }
}

function showOptions(){
  let optionsContainer = document.querySelector('#options-container');
  optionsContainer.classList.remove('minimized');
  let caret = document.getElementById('options-expand-btn')
  caret.innerHTML = '<i class="fas fa-chevron-up"></i>';	
}

function toggleDescription(el){
  el.parentElement.querySelector('.description').classList.toggle('hidden');
}


// FOR DEBUG MODE
function debug(){
  debugMode = !debugMode;
  document.getElementById('debug-container').classList.toggle('hidden');
}