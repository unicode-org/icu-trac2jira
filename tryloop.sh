#!/bin/bash

# upper bound - 14,000
# MAXK=14
for k in {0..13};
do
    lower=$(expr $k '*' 1000)
    upper=$(expr \( ${k} + 1 \) '*' 1000)
    where="where id >= $lower and id < $upper"
    echo $where
    time node try.js "${where}" 2>&1 | tee local-out${k}.txt&
done
# $ node try.js 'where id = 12002'