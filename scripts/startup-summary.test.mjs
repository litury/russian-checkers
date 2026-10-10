import {test} from 'node:test';
import assert from 'node:assert/strict';
import {t95,bound,summarize} from './startup-summary.mjs';
test('one-sided Student critical df4 matches original gate',()=>assert.ok(Math.abs(t95(4)-2.131846786)<0.000001));
test('zero variance bound',()=>assert.equal(bound([5,5,5,5,5]),5));
test('incomplete data cannot pass',()=>assert.throws(()=>summarize([],{plan:{observations:10}}),/Incomplete/));
test('pageerrors cannot pass',()=>assert.throws(()=>summarize([{errors:['failure']}],{plan:{observations:1}}),/pageerror/));
