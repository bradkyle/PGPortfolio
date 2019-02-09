const roundTo = require('round-to');

// Recieves 2 portfolio vectors: 
// i: initial/current portfolio vector
// f: final/target portfolio vector
// And a quotation object referencing the quantity of
// the asset in question that should be sold.
// and derives the transactions that need to occur
// in order to  
function derive_transactions(i, f, q) {
    
    // TODO round off initial and final objects    
    
    if (!is_one(i)) {
        console.error("The sum of the initial portfolio vector is not 1: " + sum(f).toString())
    }
    
    if (!is_one(f)) {
        console.error("The sum of the final portfolio vector is not 1: " + sum(f).toString())
    }
    
    let d = derive_delta_pv(i, f);    
    
    if (!is_zero(d)) {
        console.error("The sum of the delta portfolio vector is not 1: " + sum(d).toString())
    }
    
    // generate a set of transactions to be fulfilled.
    let t = generate_transactions(d, q);
    
    return t;
}

function derive_delta_pv(i, f) {
    let d = {}
   
   // Range over final/target portfolio vector
   // derive delta based upon the initial
   // (current) portfolio vector.
   for (let k of Object.keys(f)) {
     if (i.hasOwnProperty(k)) {
       d[k] = f[k] - i[k]
     } else {
       d[k] = f[k]
     }
   }
   
   // Range over initial/current portfolio vector
   // derive delta based upon assets that have not
   // been recognised by the final vector i.e. (The 
   // asset has been removed from the white list).
   for (let k of Object.keys(i)) {
     if (!d.hasOwnProperty(k)) {
         if (i[k] !== 0) {           
          d[k] = -i[k]
         } else {
           d[k] = i[k]
         }
     }   
   }
   
   // Range over delta pv and round off 
   // to 6 decimal places.
   for (i of Object.entries(d)){
       d[i[0]] = roundTo(i[1], 6);
   }
   
   return d;
}

// Derives the accumulative value of an objects
// scalar values
function sum( obj ) {
    var sum = 0;
    for( var el in obj ) {
      if( obj.hasOwnProperty( el ) ) {
        sum += parseFloat( obj[el] );
      }
    }
    return sum;
}

// Determines if the accumulative sum of an objects
// values equal one
function is_one(obj) {
    if (parseFloat(sum(obj).toFixed(6)) === 1){
        return true;
    } else {
        console.log(parseFloat(sum(obj).toFixed(6)))
        return false;
    }
}

// Determines if the accumulative sum of an objects
// values equal zero
function is_zero(obj) {
    if (parseFloat(sum(obj).toFixed(6)) === 0){
        return true;
    } else {        
        console.log(parseFloat(sum(obj).toFixed(6)))
        return false;
    }
}


// Generates a set of transactions(orders) that should take place
// based upon a delta portfolio vector.
function generate_transactions(d, q) {
    
    let transaction_heap = new Heap();
    let buy_heap = new Heap();
    let sell_heap = new Heap();
    
    // generate buy and sell sets from
    // delta portfolio vector.
    let buy_pv = buy_heap.fill(get_positive(d)); // buy heap
    let sell_pv = sell_heap.fill(get_negative(d)); // sell heap
   
    while(buy_heap.next()){
        // get next item in buy heap
        let b = buy_heap.next();
        
        while(!satisfied) {
            
            // get next item in sell heap
            let s = sell_heap.next()
            if (b.value === Math.abs(s.value)) {
                
                transaction_heap.add(
                ,    
                {
                
                }
                )
                
                buy_heap.remove(b);
                sell_heap.remove(s);
            
                satisfied = true;
                 
            } else if(b.value > Math.abs(s.value)) {
                
                buy_heap.update(b.key, (b.value + s.value));
                
                transaction_heap.add({
                    
                })
                
                sell_heap.remove(s);
                
            } else {
                
                sell_heap.update(s.key, (s.value + b.value));
                
                transaction_heap.add({
                    
                });
                
                buy_heap.remove(b);
                
                satisfied = true;    
            }
        }
    }
    
    return transaction_heap.arroutput();    
}

// Generates a set of transactions(orders) that should take place
// based upon a delta portfolio vector.
function generate_transactions_adj(d, q) {
    
    let transaction_heap = new Heap();
    let buy_heap = new Heap();
    let sell_heap = new Heap();
    
    // generate buy and sell sets from
    // delta portfolio vector.
    let buy_pv = buy_heap.fill(get_positive(d)); // buy heap
    let sell_pv = sell_heap.fill(get_negative(d)); // sell heap
   
    while(buy_heap.next()){
        // get next item in buy heap
        let b = buy_heap.next();
        
        while(!satisfied) {
            
            // get next item in sell heap
            let s = sell_heap.next()
            if (b.value === Math.abs(s.value)) {
                
                transaction_heap.add(
                ,    
                {
                
                }
                )
                
                buy_heap.remove(b);
                sell_heap.remove(s);
            
                satisfied = true;
                 
            } else if(b.value > Math.abs(s.value)) {
                
                buy_heap.update(b.key, (b.value + s.value));
                
                transaction_heap.add({
                    
                })
                
                sell_heap.remove(s);
                
            } else {
                
                sell_heap.update(s.key, (s.value + b.value));
                
                transaction_heap.add({
                    
                });
                
                buy_heap.remove(b);
                
                satisfied = true;    
            }
        }
    }
    
    return transaction_heap.arroutput();    
}


// Return an portfolio vector object consisting
// of entries with only negative values.
function get_negative(d) {
    let neg_d = {};
    for (i of Object.entries(d)) {
        if (i[1]<0) {
            neg_d[i[0]] = i[1]
        }
    }
    return neg_d;
}

// Return an portfolio vector object consisting
// of entries with only positive values.
function get_positive(d) {
    let pos_d = {};
    for (i of Object.entries(d)) {
        if (i[1]>0) {
            pos_d[i[0]] = i[1]
        }
    }
    return pos_d;
}
