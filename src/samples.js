// loading sample applications 
// these assume that the user hasn't changed the default set of gestures (none, shake, bow)

function loadFortune(){
    let shakeSelect = document.getElementById("shake-select");
    let bowSelect = document.getElementById("bow-select");
    let noneSelect = document.getElementById("none-select");

    if(shakeSelect && bowSelect && noneSelect){
        let dir = "samples/fortune-teller";
        // load sounds
        let tracks = [
            'without-a-doubt',
            'it-is-likely',
            'it-is-certain',
            'ask-later',
            'probably-not',
            'unfortunately-no',     
        ];
    
        document.getElementById('sounds-container').querySelectorAll('.content .sound').forEach(function(el){
            el.remove();
        })
    
        tracks.forEach(function(trackName){
            addSound(trackName, false);
        });
    
        // load default gesture behavior
        shakeSelect.value = "random";
        bowSelect.value = "none";
        noneSelect.value = "none";
        document.getElementById("timer-countdown-start-select").value = "none";
    }
}