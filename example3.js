var i = 1;
console.log('Initial value ' + i);
setTimeout(callAddOneHundred, 2000);
console.log('Value after function called ' + i);

function callAddOneHundred() {
    addOneHunder(function() {
        console.log('After waiting two seconds i = ' + i);
    })
}

function addOneHunder(cb) {
    i = 'magic!';
    cb();
}