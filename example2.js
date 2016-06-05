var i = 1;
console.log('Initial value ' + i);
setTimeout(addOneHunder, 2000);
console.log('Value after function called ' + i);


function addOneHunder() {
    i += 100;
}