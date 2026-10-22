import { registerClip } from '../ultimatePoses';
import { crew1Clips } from './crew1';
import { crew2Clips } from './crew2';
import { crew3Clips } from './crew3';
import { crew4Clips } from './crew4';
import { crew5Clips } from './crew5';

/** Registers the clips of the cinematics written outside ultimatePoses.ts. */
for (const clips of [crew1Clips(), crew2Clips(), crew3Clips(), crew4Clips(), crew5Clips()]) {
  for (const [name, c] of Object.entries(clips)) registerClip(name, c);
}
