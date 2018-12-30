
function Heap() {
    this.heap = {};
}

function Entry() {
    this.key = null;
    this.value = null;
}

Heap.prototype.next = function() {
    if (Object.keys(this.heap)>0){
        return this.heap[Object.keys(this.heap)[0]];
    } else {
        return false;
    }
}

Heap.prototype.add = function(key, value){
        this.heap[key] = {
            key: key,
            value: value
        }
}

Heap.prototype.remove = function(entry) {
    delete this.heap[entry.key];
}

Heap.prototype.ouput = function() {
    return this.heap;
}

Heap.prototype.arroutput = function() {
    return Object.values(this.values)
}

Heap.prototype.fill = function(object) {
    for (e of Object.entries(object)) {
        this.heap[e[0]] = {
            key: e[0],
            value: e[1]
        }
    }
}

Heap.prototype.update = function(key, value) {
    this.heap[key] = {
        key: key,
        value: value
    }
}
