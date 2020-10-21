// everything related to smoothie-js for live stream of incoming data, plot.ly for plotting sensor data

// for smoothiechart.js
let smoothie;
let accelXSeries = new TimeSeries();
let accelYSeries = new TimeSeries();
let accelZSeries = new TimeSeries();

let accelXArr = [];
let accelYArr = [];
let accelZArr = [];

let accelXSample = [];
let accelYSample = [];
let accelZSample = [];

// for plot.ly
let peaksArr = [];

function setupDataCollection() {
  accelXArr = [];
  accelYArr = [];
  accelZArr = [];

  smoothie = new SmoothieChart({ tooltip: false });
  smoothie.addTimeSeries(accelXSeries, { strokeStyle: "red" });
  smoothie.addTimeSeries(accelYSeries, { strokeStyle: "green" });
  smoothie.addTimeSeries(accelZSeries, { strokeStyle: "blue" });
  smoothie.streamTo(document.getElementById("smoothie-chart"), 1000); // delay in MS
  smoothie.start();
}

function average(data) {
  var sum = data.reduce(function (sum, value) {
    return sum + value;
  }, 0);

  var avg = sum / data.length;
  return avg;
}

function max(data) {
  return Math.max(data);
}

function standardDeviation(values) {
  var avg = average(values);

  var squareDiffs = values.map(function (value) {
    var diff = value - avg;
    var sqrDiff = diff * diff;
    return sqrDiff;
  });

  var avgSquareDiff = average(squareDiffs);

  var stdDev = Math.sqrt(avgSquareDiff);
  return stdDev;
}

// peak detection from https://stackoverflow.com/questions/22583391/peak-signal-detection-in-realtime-timeseries-data/57889588#57889588
function sum(a) {
  return a.reduce((acc, val) => acc + val);
}

function mean(a) {
  return sum(a) / a.length;
}

function stddev(arr) {
  const arr_mean = mean(arr);
  const r = function (acc, val) {
    return acc + (val - arr_mean) * (val - arr_mean);
  };
  return Math.sqrt(arr.reduce(r, 0.0) / arr.length);
}

function peaks(y, params) {
  var p = params || {};
  // init cooefficients
  const lag = p.lag || 5;
  const threshold = p.threshold || 3.5;
  const influence = p.influece || 0.5;

  let peaksCounter = 0;

  if (y === undefined || y.length < lag + 2) {
    throw ` ## y data array to short(${y.length}) for given lag of ${lag}`;
  }
  //console.log(`lag, threshold, influence: ${lag}, ${threshold}, ${influence}`)

  // init variables
  var signals = Array(y.length).fill(0);
  var filteredY = y.slice(0);
  const lead_in = y.slice(0, lag);
  //console.log("1: " + lead_in.toString())

  var avgFilter = [];
  avgFilter[lag - 1] = mean(lead_in);
  var stdFilter = [];
  stdFilter[lag - 1] = stddev(lead_in);
  //console.log("2: " + stdFilter.toString())

  for (var i = lag; i < y.length; i++) {
    //console.log(`${y[i]}, ${avgFilter[i-1]}, ${threshold}, ${stdFilter[i-1]}`)
    // added in Math.abs(y[i] - avgFilter[i - 1]) > 0.1 to account for peak detection when differences are very small
    if (
      Math.abs(y[i] - avgFilter[i - 1]) > 0.1 &&
      Math.abs(y[i] - avgFilter[i - 1]) > threshold * stdFilter[i - 1]
    ) {
      if (y[i] > avgFilter[i - 1]) {
        signals[i] = +1; // positive signal
        if (i - 1 > 0 && signals[i - 1] == 0) {
          peaksCounter++;
        }
      } else {
        signals[i] = -1; // negative signal
      }
      // make influence lower
      filteredY[i] = influence * y[i] + (1 - influence) * filteredY[i - 1];
    } else {
      signals[i] = 0; // no signal
      filteredY[i] = y[i];
    }

    // adjust the filters
    const y_lag = filteredY.slice(i - lag, i);
    avgFilter[i] = mean(y_lag);
    stdFilter[i] = stddev(y_lag);
  }
  return { numPeaks: peaksCounter, results: signals };
}

function generatePlotly(id, container, dataX, dataY, dataZ) {

  let plot = document.createElement("div");
  let name = id; // default
  let forDebug = false;
  if(typeof id == 'string'){
    forDebug = id.includes('debug');
  }
  
  let plotTitle;
  
  if(!forDebug){
    name =
    "gesture_" + currentGesture + "_sample_" + container.children.length;
  }
  plot.setAttribute("id", name);
  plot.classList.add("plot");
  if(!forDebug){
    container.prepend(plot);
  }else{
    container.append(plot);
  }
//   console.log("generating plot for gesture", currentGesture, " ", name);
  let defaultWidth = 300;

  if(forDebug){
    if(id.includes('timeline')){
      // 6 second window debug
      defaultWidth = 600;
      plotTitle = 'Last 10 seconds'
    }else if(id.includes('subplot')){
      // 2 second window debug
      let window = parseInt(id.replace('debug-subplot_', ''));
      switch(window){
        case 0:
          plotTitle = '0-2 seconds';
          break;
        case 1:
          plotTitle = '2-4 seconds';
          break;
        case 2:
          plotTitle = '4-6 seconds';
          break;
        case 3:
          plotTitle = '6-8 seconds';
          break;
        case 4:
          plotTitle = '8-10 seconds';
          break;
      }
    }
  }

  Plotly.newPlot(
    name,
    [
      {
        y: dataX,
        mode: "lines",
        line: { color: "red" },
        name: "ax",
      },
      {
        y: dataY,
        mode: "lines",
        line: { color: "green" },
        name: "ay",
      },
      {
        y: dataZ,
        mode: "lines",
        line: { color: "blue" },
        name: "az",
      },
    ],
    plotlyLayout(defaultWidth, plotTitle),
    { staticPlot: false,
    displayModeBar: false}
  );

  // add remove btn
  if(!forDebug){
    let removeBtn = document.createElement("div");
    removeBtn.classList.add("remove");
    removeBtn.innerHTML = removeIcon;
    removeBtn.addEventListener("click", function () {
      removeData(id);
    });
    plot.append(removeBtn);
  }

  // generate peaks data
  let peaksData = peaks(dataX);
  peaksArr[0] = peaksData.numPeaks;
  peaksData = peaks(dataY);
  peaksArr[1] = peaksData.numPeaks;
  peaksData = peaks(dataZ);
  peaksArr[2] = peaksData.numPeaks;

  if(forDebug && id.includes('debug-subplot')){
    // add debugging plots for peak detection
    let peakContainer = document.createElement('div');
    peakContainer.classList.add('peak-container');
    container.append(peakContainer);

    createPeakChart(dataX, name+'x', 'X', peakContainer);
    createPeakChart(dataY, name+'Y', 'Y', peakContainer);
    createPeakChart(dataZ, name+'Z', 'Z', peakContainer);
  }
}

function createPeakChart(data, id, axis, parent){
  // data is the raw accelerometer data
  let plotContainer = document.createElement('div');
  plotContainer.setAttribute('id', id);
  parent.append(plotContainer);
  let peaksData = peaks(data);
  let peakColor;
  switch(axis){
    case 'X':
      peakColor = 'red';
      break;
    case 'Y':
      peakColor = 'green';
      break;
    case 'Z': 
      peakColor = 'blue';
      break;
  }

  Plotly.newPlot(id, [{
    y: peaksData.results,
    mode: 'lines', 
    line: {color: 'black'},
    name: 'peaks'
  },{
    y: data,
    mode: 'lines',
    line: {color: peakColor},
    name: 'data'
  }],
  plotlyLayout(200, `Peaks ${axis}`),
  {staticPlot: true});

  // add peak info
  let dataContainer = document.createElement('div');
  dataContainer.classList.add('peaks-label')
  dataContainer.innerHTML = `Peaks: ${peaksData.numPeaks}`;
  plotContainer.append(dataContainer);
}

function removeData(id) {
  let remove = confirm("Are you sure you want to remove this data?");
  if (remove) {
    gestureData = gestureData.filter((data) => data.id !== id);
    let parentGesture = event.target.closest('.gesture-container').id;

    // remove the plot
    event.target.closest(".plot").remove();

    // update sample
    updateSampleCounter(parentGesture);
  }
}

function updateSampleCounter(gestureName) {
  let counterContainer = document.querySelector(
    `#${gestureName} .sample-counter`
  );
  let sampleContainer = document.querySelector(
    `#${gestureName} .sample-container`
  );
  let gestureContainer = document.querySelector(`#${gestureName}`);

  let sampleCount = sampleContainer.children.length;
  let minSamples = 3;
  let msg;
  if (sampleCount < minSamples) {
    gestureContainer.classList.remove("ready");
    gestureContainer.classList.add("incomplete");
    msg = `record ${minSamples - sampleCount} more ${pluralize(
      "sample",
      minSamples - sampleCount
    )}`;
  } else {
    gestureContainer.classList.remove("incomplete");
    gestureContainer.classList.add("ready");
    msg = `Samples: ${sampleCount}`;
  }
  counterContainer.innerHTML = msg;
  updateMLBtns();
}

// DEBUG 
let debugIndex = 0;

function showDebug(btn){
  debugIndex = 0;
  // display a chart with the last 6 seconds of data
  let sampleSize = 97;
  let sampleLength = sampleSize*5; // 97 samples in ~10 seconds
  let ax = accelXArr.slice(accelXArr.length - sampleLength);
  let ay = accelYArr.slice(accelYArr.length - sampleLength);
  let az = accelZArr.slice(accelZArr.length - sampleLength);  
  let container = document.getElementById('debug-timeline');
  container.innerHTML = '';  // clear contents
  generatePlotly('debug-timeline', container, ax, ay, az);

  // display charts from 2 second samples
  let displayContainer = document.getElementById('debug-charts');
  displayContainer.innerHTML = '';
  // console.log('ax:', ax, 'ay:', ay, 'az:', az);

  for(i=0; i< sampleLength / sampleSize; i++){
    // console.log('generate plot for debug ', i);
    let start = sampleSize * i;
    let ax_slice = ax.slice(start, sampleSize + start-1);
    let ay_slice = ay.slice(start, sampleSize + start-1);
    let az_slice = az.slice(start, sampleSize + start-1);
    // console.log('ax_slice:', ax_slice, 'ay_slice:', ay_slice, 'az_slice:', az_slice);
    generatePlotly(`debug-subplot_${i}`, displayContainer, ax_slice, ay_slice, az_slice);
    runDebugPrediction(ax_slice, ay_slice, az_slice);
  }
}

function runDebugPrediction(ax, ay, az){
  // console.log('run debug prediction for index ', debugIndex);
  let inputs = {
    ax_max: Math.max(...ax),
    ax_min: Math.min(...ax),
    ax_std: standardDeviation(ax),
    ax_peaks: peaks(ax).numPeaks,
    ay_max: Math.max(...ay),
    ay_min: Math.min(...ay),
    ay_std: standardDeviation(ay),
    ay_peaks: peaks(ay).numPeaks,
    az_max: Math.max(...az),
    az_min: Math.min(...az),
    az_std: standardDeviation(az),
    az_peaks: peaks(az).numPeaks,
  };

  model.classify(inputs, debugPredictionResults);
}

function debugPredictionResults(error, results){
  if(error){
    console.error(error);
  }

  // console.log('debugPredictionResults for index ', debugIndex);

  let confidenceContainer = document.createElement('div');
  let body = '';
  results.forEach(function(gesture){
    body += `<label>${gesture.label}</label> ${(gesture.confidence*100).toFixed(0)}% `;
  });
  confidenceContainer.innerHTML = body;
  let container = document.getElementById(`debug-subplot_${debugIndex}`);
  container.append(confidenceContainer);
  debugIndex++;
}

function plotlyLayout(width, title){
  let topMargin = 15;
  if(title){
    topMargin = 30;
  }
  let layout = {
    autosize: false,
    width: width,
    height: 200,
    margin: {
      l: 20,
      r: 15,
      pad: 0,
      t: topMargin,
      b: 20,
    },
    legend: {
      orientation: "h",
    },
    yaxis: {fixedrange: true},
    xaxis: {fixedrange: true},
    title: {
      text: title
    }
  };
  return layout;
}