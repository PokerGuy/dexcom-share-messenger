var dexData = module.exports = {
    glucose: null,
    trend: null,
    lastEntry: null,
    next: null,
    setGlucose: function(g) {
        dexData.glucose = g;
    },
    setTrend: function(t) {
        dexData.trend = t;
    },
    setLastEntry: function(l) {
        dexData.lastEntry = l;
    },
    setNext: function(n) {
        dexData.next = n;
    }
};